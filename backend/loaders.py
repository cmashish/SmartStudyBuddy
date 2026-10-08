import os

from langchain_community.document_loaders import PyPDFLoader, TextLoader


def load_documents_from_directory(directory: str):
    docs = []

    if not os.path.isdir(directory):
        print(f"Notes directory does not exist: {directory}")
        return docs

    for filename in sorted(os.listdir(directory)):
        path = os.path.join(directory, filename)

        if not os.path.isfile(path):
            continue

        try:
            lower_name = filename.lower()

            if lower_name.endswith(".pdf"):
                docs.extend(PyPDFLoader(path).load())
            elif lower_name.endswith(".txt"):
                docs.extend(TextLoader(path, encoding="utf-8").load())

        except Exception as exc:
            print(f"Could not load {filename}: {exc}")

    print(f"Loaded {len(docs)} document pages/chunks from {directory}")
    return docs
