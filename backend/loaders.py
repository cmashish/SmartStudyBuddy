import os
from pathlib import Path

from langchain_community.document_loaders import PyPDFLoader, TextLoader

SUPPORTED_EXTENSIONS = {".pdf", ".txt"}


def load_document_file(path: str):
    file_path = Path(path)

    if not file_path.exists():
        raise FileNotFoundError(f"Document not found: {file_path}")

    suffix = file_path.suffix.lower()

    if suffix == ".pdf":
        return PyPDFLoader(str(file_path)).load()

    if suffix == ".txt":
        return TextLoader(str(file_path), encoding="utf-8").load()

    raise ValueError("Only PDF and TXT files are supported")


def load_documents_from_directory(directory: str):
    docs = []
    if not os.path.isdir(directory):
        return docs

    for filename in sorted(os.listdir(directory)):
        path = os.path.join(directory, filename)
        if not os.path.isfile(path):
            continue
        if Path(filename).suffix.lower() not in SUPPORTED_EXTENSIONS:
            continue

        try:
            docs.extend(load_document_file(path))
        except Exception as exc:
            print(f"Could not load {filename}: {exc}")

    return docs
