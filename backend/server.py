import os
import threading
import uuid
from collections import defaultdict
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from langchain_text_splitters import RecursiveCharacterTextSplitter

from config import load_config
from embeddings import create_embeddings_model
from loaders import load_document_file
from vectorstore import LocalVectorStore
from rag import create_qa_chain

load_dotenv()

app = FastAPI(
    title="Smart Study Buddy API",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    session_id: str = Field(min_length=1, max_length=128)
    message: str = Field(min_length=1, max_length=10000)


_sessions = defaultdict(list)
_lock = threading.RLock()
_init_lock = threading.Lock()
_embeddings = None
_store = None
_qa_chain = None
_init_error = None


def _initialize():
    global _embeddings, _store, _qa_chain, _init_error

    if _qa_chain is not None:
        return _qa_chain

    with _init_lock:
        if _qa_chain is not None:
            return _qa_chain

        try:
            config = load_config()

            model_name = os.getenv(
                "EMBEDDING_MODEL",
                "all-MiniLM-L6-v2",
            )

            _embeddings = create_embeddings_model(model_name)
            _store = LocalVectorStore(
                embeddings=_embeddings,
                index_path=config["INDEX_PATH"],
            )

            _qa_chain = create_qa_chain(_store)
            _init_error = None
            return _qa_chain

        except Exception as exc:
            _init_error = exc
            raise


def _get_store():
    _initialize()
    return _store


def _split_documents(documents):
    chunk_size = int(os.getenv("CHUNK_SIZE", "900"))
    chunk_overlap = int(os.getenv("CHUNK_OVERLAP", "150"))

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", ". ", " ", ""],
    )

    return splitter.split_documents(documents)


@app.on_event("startup")
def startup():
    try:
        _initialize()
        print("Smart Study Buddy RAG initialized")
    except Exception as exc:
        # Keep the API alive so /health exposes the actual initialization error.
        print(f"RAG initialization failed: {exc}")


@app.get("/")
def root():
    return {
        "status": "ok",
        "service": "Smart Study Buddy API",
        "version": "2.0.0",
        "docs": "/docs",
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "rag_initialized": _qa_chain is not None,
        "vector_chunks": _store.count if _store else 0,
        "ollama_model": os.getenv("OLLAMA_MODEL", "llama3.2:3b"),
        "initialization_error": str(_init_error) if _init_error else None,
    }


@app.get("/documents")
def list_documents():
    try:
        store = _get_store()
        return {
            "documents": store.list_documents(),
            "total_chunks": store.count,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/documents/upload")
async def upload_document(file: UploadFile = File(...)):
    """Save uploads in bounded chunks and index the saved file."""
    config = load_config()
    filename = Path(file.filename or "").name
    suffix = Path(filename).suffix.lower()

    if not filename:
        await file.close()
        raise HTTPException(status_code=400, detail="Filename is required.")

    if suffix not in {".pdf", ".txt"}:
        await file.close()
        raise HTTPException(
            status_code=400,
            detail="Only PDF and TXT files are supported.",
        )

    max_file_size = int(os.getenv("MAX_UPLOAD_SIZE_MB", "500")) * 1024 * 1024
    copy_chunk_size = 1024 * 1024
    document_id = uuid.uuid4().hex
    destination = Path(config["UPLOAD_DIR"]) / f"{document_id}_{filename}"
    total_bytes = 0

    try:
        destination.parent.mkdir(parents=True, exist_ok=True)

        with destination.open("wb") as output:
            while True:
                chunk = await file.read(copy_chunk_size)
                if not chunk:
                    break

                total_bytes += len(chunk)
                if total_bytes > max_file_size:
                    raise HTTPException(
                        status_code=413,
                        detail=(
                            "File exceeds the configured upload limit of "
                            f"{max_file_size // (1024 * 1024)} MB."
                        ),
                    )
                output.write(chunk)

        if total_bytes == 0:
            raise HTTPException(status_code=400, detail="The uploaded file is empty.")

        # Existing synchronous processing is retained for API compatibility.
        documents = load_document_file(str(destination))
        if not documents:
            raise ValueError("No readable text was found in the document.")

        for document in documents:
            document.metadata = dict(document.metadata or {})
            document.metadata.update({
                "document_id": document_id,
                "filename": filename,
            })

        chunks = _split_documents(documents)
        if not chunks:
            raise ValueError("The document did not produce any text chunks.")

        store = _get_store()
        added = store.add_documents(chunks)

        # Verify this specific upload is visible to the same listing endpoint
        # the frontend uses. Never report ready if its metadata is absent.
        indexed_documents = store.list_documents()
        indexed_item = next(
            (item for item in indexed_documents
             if item.get("document_id") == document_id),
            None,
        )
        if indexed_item is None or int(indexed_item.get("chunks", 0)) <= 0:
            raise RuntimeError(
                "Chunks were processed but this document is not visible in "
                "the vector store listing. Check vectorstore.py metadata and "
                "confirm the API is using the expected index file."
            )

        print(
            f"[UPLOAD] indexed document_id={document_id}, filename={filename}, "
            f"new_chunks={added}, document_chunks={indexed_item['chunks']}, "
            f"total_chunks={store.count}"
        )

        return {
            "document_id": document_id,
            "filename": filename,
            "status": "ready",
            "bytes_uploaded": total_bytes,
            "chunks": int(indexed_item["chunks"]),
            "new_chunks": added,
            "total_chunks": store.count,
        }

    except HTTPException:
        if destination.exists():
            destination.unlink(missing_ok=True)
        raise
    except Exception as exc:
        if destination.exists():
            destination.unlink(missing_ok=True)
        raise HTTPException(
            status_code=500,
            detail=f"Document processing failed: {exc}",
        ) from exc
    finally:
        await file.close()


@app.delete("/documents/{document_id}")
def delete_document(document_id: str):
    try:
        config = load_config()
        store = _get_store()
        removed_chunks = store.delete_document(document_id)

        if removed_chunks == 0:
            raise HTTPException(
                status_code=404,
                detail="Document not found.",
            )

        upload_dir = Path(config["UPLOAD_DIR"])
        for path in upload_dir.iterdir():
            if path.is_file() and path.name.startswith(f"{document_id}_"):
                path.unlink(missing_ok=True)

        return {
            "document_id": document_id,
            "deleted": True,
            "removed_chunks": removed_chunks,
        }

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/chat")
def chat(request: ChatRequest):
    try:
        qa_chain = _initialize()

        with _lock:
            history = list(_sessions[request.session_id])

        result = qa_chain.invoke(
            {
                "input": request.message,
                "chat_history": history,
            }
        )

        answer = result.get("answer", "")
        sources = result.get("source_documents", [])

        with _lock:
            _sessions[request.session_id].append(
                {"role": "user", "content": request.message}
            )
            _sessions[request.session_id].append(
                {"role": "assistant", "content": answer}
            )

        return {
            "session_id": request.session_id,
            "answer": answer,
            "sources": sources,
        }

    except Exception as exc:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/history/{session_id}")
def get_history(session_id: str):
    with _lock:
        return {
            "session_id": session_id,
            "messages": list(_sessions[session_id]),
        }


@app.delete("/history/{session_id}")
def clear_history(session_id: str):
    with _lock:
        _sessions.pop(session_id, None)

    return {
        "session_id": session_id,
        "cleared": True,
    }
