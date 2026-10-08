import os
import threading
from collections import defaultdict

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from config import load_config
from loaders import load_documents_from_directory
from embeddings import create_embeddings_model
from vectorstore import initialize_vectorstore
from rag import create_qa_chain

load_dotenv()

app = FastAPI(title="Smart Study Buddy API", version="1.0.0")

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
_lock = threading.Lock()
_init_lock = threading.Lock()
_qa_chain = None
_init_error = None


def _initialize():
    global _qa_chain, _init_error

    if _qa_chain is not None:
        return _qa_chain

    with _init_lock:
        if _qa_chain is not None:
            return _qa_chain

        try:
            config = load_config()

            documents = load_documents_from_directory(
                config["NOTES_DIR"]
            )

            use_openai = (
                os.getenv("USE_OPENAI_EMBEDDINGS", "false").lower()
                == "true"
            )

            model_name = os.getenv(
                "EMBEDDING_MODEL",
                "text-embedding-3-small"
                if use_openai
                else "all-MiniLM-L6-v2",
            )

            embeddings = create_embeddings_model(
                model_name,
                use_openai=use_openai,
            )

            store = initialize_vectorstore(
                embeddings,
                documents,
            )

            _qa_chain = create_qa_chain(store)
            _init_error = None

            return _qa_chain

        except Exception as exc:
            _init_error = exc
            raise


@app.get("/")
def root():
    return {
        "status": "ok",
        "service": "Smart Study Buddy API",
        "docs": "/docs",
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "rag_initialized": _qa_chain is not None,
        "initialization_error": str(_init_error) if _init_error else None,
    }


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
                {
                    "role": "user",
                    "content": request.message,
                }
            )
            _sessions[request.session_id].append(
                {
                    "role": "assistant",
                    "content": answer,
                }
            )

        return {
            "session_id": request.session_id,
            "answer": answer,
            "sources": [
                {
                    "source": doc.metadata.get("source", "unknown"),
                    "page": doc.metadata.get("page"),
                }
                for doc in sources
            ],
        }

    except Exception as exc:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )


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
