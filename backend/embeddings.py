import os

from langchain_huggingface import HuggingFaceEmbeddings
from langchain_openai import OpenAIEmbeddings


def create_embeddings_model(model_name: str, use_openai: bool = False):
    if use_openai:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY is not set")
        return OpenAIEmbeddings(
            api_key=api_key,
            model=model_name,
        )

    return HuggingFaceEmbeddings(model_name=model_name)


def get_embedding_dimension(model_name: str, use_openai: bool = False) -> int:
    if use_openai:
        dimensions = {
            "text-embedding-3-small": 1536,
            "text-embedding-3-large": 3072,
        }
        if model_name in dimensions:
            return dimensions[model_name]
        raise ValueError(
            f"Unknown OpenAI embedding model '{model_name}'. "
            "Set the correct dimension in embeddings.py."
        )

    if model_name == "all-MiniLM-L6-v2":
        return 384

    raise ValueError(f"Unknown embedding model: {model_name}")
