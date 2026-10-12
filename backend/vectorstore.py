import hashlib
import pickle
import threading
from pathlib import Path
from typing import Any

import numpy as np


class LocalVectorStore:
    """Persistent local cosine-similarity index for study-document chunks."""

    def __init__(self, embeddings, index_path: str):
        self.embeddings = embeddings
        self.index_path = Path(index_path)
        self.index_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._vectors = np.empty((0, 0), dtype=np.float32)
        self._normalized_vectors = np.empty((0, 0), dtype=np.float32)
        self._documents: list[dict[str, Any]] = []
        self._load()

    @property
    def count(self) -> int:
        return len(self._documents)

    @staticmethod
    def _normalize_rows(matrix: np.ndarray) -> np.ndarray:
        if matrix.size == 0:
            return matrix.astype(np.float32, copy=False)
        norms = np.linalg.norm(matrix, axis=1, keepdims=True)
        return matrix / np.maximum(norms, 1e-12)

    def _refresh_normalized_vectors(self):
        # Cache normalized vectors so every query doesn't recalculate norms
        # for the complete document collection.
        self._normalized_vectors = self._normalize_rows(self._vectors)

    def _load(self):
        if not self.index_path.exists():
            return
        try:
            with self.index_path.open("rb") as file:
                payload = pickle.load(file)
            vectors = np.asarray(payload.get("vectors", []), dtype=np.float32)
            documents = payload.get("documents", [])
            if vectors.ndim == 1 and vectors.size:
                vectors = vectors.reshape(1, -1)
            self._vectors = vectors
            self._documents = documents
            self._refresh_normalized_vectors()
            print(f"Loaded local RAG index: {self.count} chunks")
        except Exception as exc:
            raise RuntimeError(
                f"Could not load local RAG index '{self.index_path}': {exc}"
            ) from exc

    def _save(self):
        temp_path = self.index_path.with_suffix(".tmp")
        with temp_path.open("wb") as file:
            pickle.dump(
                {"vectors": self._vectors, "documents": self._documents},
                file,
                protocol=pickle.HIGHEST_PROTOCOL,
            )
        temp_path.replace(self.index_path)

    @staticmethod
    def _document_id(document) -> str:
        metadata = document.metadata or {}
        # Scope chunk IDs to an upload/document. Without document_id, a chunk
        # deduplicated from an earlier upload can keep the earlier metadata,
        # causing the new filename to be absent from list_documents().
        raw = (
            f"{metadata.get('document_id', '')}|"
            f"{metadata.get('source', '')}|"
            f"{metadata.get('page', '')}|"
            f"{document.page_content}"
        )
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    def add_documents(self, documents: list[Any]) -> int:
        if not documents:
            return 0

        texts = [doc.page_content for doc in documents]
        vectors = np.asarray(
            self.embeddings.embed_documents(texts), dtype=np.float32
        )

        with self._lock:
            existing_ids = {item["id"] for item in self._documents}
            new_vectors, new_documents = [], []

            for document, vector in zip(documents, vectors):
                document_id = self._document_id(document)
                if document_id in existing_ids:
                    continue
                new_documents.append({
                    "id": document_id,
                    "text": document.page_content,
                    "metadata": dict(document.metadata or {}),
                })
                new_vectors.append(vector)
                existing_ids.add(document_id)

            if not new_documents:
                return 0

            matrix = np.asarray(new_vectors, dtype=np.float32)
            self._vectors = (
                matrix if self._vectors.size == 0
                else np.vstack((self._vectors, matrix))
            )
            self._documents.extend(new_documents)
            self._refresh_normalized_vectors()
            self._save()
            return len(new_documents)

    def similarity_search(self, query: str, k: int = 4):
        with self._lock:
            if not self._documents or self._normalized_vectors.size == 0:
                return []

            query_vector = np.asarray(
                self.embeddings.embed_query(query), dtype=np.float32
            )
            query_norm = float(np.linalg.norm(query_vector))
            if query_norm == 0:
                return []

            query_vector = query_vector / query_norm
            scores = self._normalized_vectors @ query_vector

            count = min(max(int(k), 1), len(scores))
            if count < len(scores):
                # argpartition avoids sorting every chunk in a large index.
                candidates = np.argpartition(scores, -count)[-count:]
                indices = candidates[np.argsort(scores[candidates])[::-1]]
            else:
                indices = np.argsort(scores)[::-1]

            return [
                {
                    "id": self._documents[int(i)]["id"],
                    "text": self._documents[int(i)]["text"],
                    "metadata": self._documents[int(i)]["metadata"],
                    "score": float(scores[int(i)]),
                }
                for i in indices
            ]

    def delete_document(self, document_id: str) -> int:
        with self._lock:
            keep = [
                i for i, item in enumerate(self._documents)
                if item["metadata"].get("document_id") != document_id
            ]
            removed = len(self._documents) - len(keep)
            if not removed:
                return 0

            self._documents = [self._documents[i] for i in keep]
            self._vectors = (
                self._vectors[keep]
                if keep else np.empty((0, 0), dtype=np.float32)
            )
            self._refresh_normalized_vectors()
            self._save()
            return removed

    def list_documents(self):
        documents = {}
        for item in self._documents:
            metadata = item["metadata"]
            document_id = metadata.get("document_id")
            if not document_id:
                continue
            if document_id not in documents:
                documents[document_id] = {
                    "document_id": document_id,
                    "filename": metadata.get("filename", "unknown"),
                    "chunks": 0,
                }
            documents[document_id]["chunks"] += 1
        return list(documents.values())
