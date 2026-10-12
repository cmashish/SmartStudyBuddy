from langchain_huggingface import HuggingFaceEmbeddings


def create_embeddings_model(
    model_name: str = "all-MiniLM-L6-v2",
    use_openai: bool = False,
):
    if use_openai:
        raise ValueError(
            "Phase 1 uses local HuggingFace embeddings. "
            "Set USE_OPENAI_EMBEDDINGS=false."
        )

    return HuggingFaceEmbeddings(
        model_name=model_name,
        model_kwargs={"device": "cpu"},
        encode_kwargs={"normalize_embeddings": True},
    )


def get_embedding_dimension(model_name: str = "all-MiniLM-L6-v2"):
    if model_name == "all-MiniLM-L6-v2":
        return 384
    raise ValueError(
        f"Unknown local embedding model: {model_name}"
    )
