import hashlib
import os
import time

from pinecone import Pinecone, ServerlessSpec
from langchain_pinecone import PineconeVectorStore

from embeddings import get_embedding_dimension


def _wait_for_index(pc: Pinecone, index_name: str, timeout_seconds: int = 60):
    """Wait until a newly-created Pinecone index reports ready."""
    deadline = time.time() + timeout_seconds

    while time.time() < deadline:
        description = pc.describe_index(name=index_name)
        status = getattr(description, "status", None)

        if isinstance(status, dict):
            ready = status.get("ready", False)
        else:
            ready = getattr(status, "ready", False)

        if ready:
            return

        time.sleep(2)

    raise TimeoutError(
        f"Pinecone index '{index_name}' was not ready within "
        f"{timeout_seconds} seconds."
    )


def initialize_vectorstore(embeddings, documents=None):
    api_key = os.getenv("PINECONE_API_KEY")
    if not api_key:
        raise ValueError("PINECONE_API_KEY is not set")

    index_name = os.getenv("PINECONE_INDEX_NAME", "smart-study-buddy")
    model_name = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
    use_openai = os.getenv("USE_OPENAI_EMBEDDINGS", "false").lower() == "true"
    dimension = get_embedding_dimension(model_name, use_openai)

    pc = Pinecone(api_key=api_key)
    existing_indexes = {index.name for index in pc.list_indexes()}

    if index_name not in existing_indexes:
        print(
            f"Creating Pinecone index '{index_name}' "
            f"with dimension={dimension}..."
        )
        pc.create_index(
            name=index_name,
            dimension=dimension,
            metric="cosine",
            spec=ServerlessSpec(
                cloud=os.getenv("PINECONE_CLOUD", "aws"),
                region=os.getenv("PINECONE_REGION", "us-east-1"),
            ),
        )
        _wait_for_index(pc, index_name)

    store = PineconeVectorStore(
        index_name=index_name,
        embedding=embeddings,
    )

    if documents:
        ids = []
        for doc in documents:
            metadata = doc.metadata or {}
            raw = (
                f"{metadata.get('source', '')}|"
                f"{metadata.get('page', '')}|"
                f"{doc.page_content}"
            )
            ids.append(hashlib.sha256(raw.encode("utf-8")).hexdigest())

        print(f"Upserting {len(documents)} document chunks into Pinecone...")
        store.add_documents(documents=documents, ids=ids)

    return store
