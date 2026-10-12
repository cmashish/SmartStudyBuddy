import json
import os
import time
import urllib.error
import urllib.request

FALLBACK_ANSWER = "Content not available in the uploaded documents."
DEFAULT_RETRIEVAL_THRESHOLD = 0.10

SYSTEM_PROMPT = """You are Smart Study Buddy.

Answer ONLY from the supplied uploaded-document context. Do not use general
knowledge, guess, or treat chat history as evidence. If the answer is not
supported by the context, reply exactly:
Content not available in the uploaded documents.

If only part is supported, answer only that part. Be concise and preserve
facts, values, formulas, and terminology from the source.

UPLOADED-DOCUMENT CONTEXT:
{context}
"""


def _ollama_chat(messages: list[dict], model: str, base_url: str) -> str:
    payload = {
        "model": model,
        "messages": messages,
        "stream": False,
        "keep_alive": os.getenv("OLLAMA_KEEP_ALIVE", "10m"),
        "options": {
            "temperature": 0,
            "num_predict": int(os.getenv("OLLAMA_NUM_PREDICT", "256")),
            "num_ctx": int(os.getenv("OLLAMA_NUM_CTX", "2048")),
        },
    }

    request = urllib.request.Request(
        f"{base_url.rstrip('/')}/api/chat",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            result = json.loads(response.read().decode("utf-8"))
    except urllib.error.URLError as exc:
        raise RuntimeError(
            "Cannot connect to Ollama. Start Ollama and make sure model "
            f"'{model}' is installed. Expected Ollama at {base_url}."
        ) from exc
    except Exception as exc:
        raise RuntimeError(f"Ollama request failed: {exc}") from exc

    answer = result.get("message", {}).get("content", "").strip()
    print(
        "[OLLAMA] total_seconds:",
            round(result.get("total_duration", 0) / 1e9, 2),
        )
    print(
       "[OLLAMA] load_seconds:",
        round(result.get("load_duration", 0) / 1e9, 2),
        )
    print(
        "[OLLAMA] prompt_tokens:",
        result.get("prompt_eval_count", 0),
    )
    print(
        "[OLLAMA] prompt_seconds:",
        round(result.get("prompt_eval_duration", 0) / 1e9, 2),
    )
    print(
        "[OLLAMA] output_tokens:",
        result.get("eval_count", 0),
    )
    print(
        "[OLLAMA] generation_seconds:",
        round(result.get("eval_duration", 0) / 1e9, 2),
    )
    if not answer:
        raise RuntimeError("Ollama returned an empty answer")
    return answer


def _threshold() -> float:
    try:
        value = float(os.getenv(
            "RETRIEVAL_SCORE_THRESHOLD",
            str(DEFAULT_RETRIEVAL_THRESHOLD),
        ))
    except ValueError:
        value = DEFAULT_RETRIEVAL_THRESHOLD
    return max(-1.0, min(1.0, value))


def _is_fallback(answer: str) -> bool:
    normalized = " ".join(answer.casefold().split())
    return normalized in {
        FALLBACK_ANSWER.casefold(),
        "i'm sorry, but i couldn't find information about that in your uploaded study material.",
        "the answer is not available in the uploaded documents",
    }


def create_qa_chain(vectorstore):
    if vectorstore is None:
        raise ValueError("vectorstore cannot be None")

    model = os.getenv("OLLAMA_MODEL", "llama3.2:3b")
    base_url = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
    retrieval_k = max(1, int(os.getenv("RETRIEVAL_K", "4")))
    score_threshold = _threshold()

    class QAAdapter:
        def invoke(self, data):
            if not isinstance(data, dict):
                raise TypeError("QA input must be a dictionary")

            query = str(data.get("input", "")).strip()
            if not query:
                raise ValueError("input cannot be empty")

            started = time.perf_counter()
            matches = vectorstore.similarity_search(query, k=retrieval_k)
            retrieval_ms = (time.perf_counter() - started) * 1000

            # Keep chunks above threshold, plus direct phrase matches for
            # short exact headings such as "Professional Summary".
            query_norm = " ".join(query.casefold().split())
            relevant = [
                m for m in matches
                if float(m.get("score", -1.0)) >= score_threshold
            ]

            if len(query_norm) >= 3:
                for match in matches:
                    text_norm = " ".join(
                        str(match.get("text", "")).casefold().split()
                    )
                    if query_norm in text_norm and match not in relevant:
                        relevant.append(match)

            print(
                f"[RAG] retrieval_ms={retrieval_ms:.1f}, "
                f"candidates={len(matches)}, relevant={len(relevant)}, "
                f"threshold={score_threshold}"
            )

            if not relevant:
                return {
                    "answer": FALLBACK_ANSWER,
                    "source_documents": [],
                    "available": False,
                }

            context_parts = []
            sources = []
            for match in relevant:
                metadata = match.get("metadata") or {}
                filename = metadata.get(
                    "filename", metadata.get("source", "unknown")
                )
                page = metadata.get("page")
                page_label = (
                    f" page {int(page) + 1}" if isinstance(page, int) else ""
                )
                text = str(match.get("text", "")).strip()
                if not text:
                    continue

                context_parts.append(f"Source: {filename}{page_label}\n{text}")
                sources.append({
                    "source": filename,
                    "page": page,
                    "score": round(float(match.get("score", 0.0)), 4),
                })

            if not context_parts:
                return {
                    "answer": FALLBACK_ANSWER,
                    "source_documents": [],
                    "available": False,
                }

            # Keep prompt small: context is capped and history is limited to
            # the most recent 2 messages. This reduces LLM prefill time.
            max_context_chars = int(os.getenv("RAG_MAX_CONTEXT_CHARS", "9000"))
            context = "\n\n---\n\n".join(context_parts)[:max_context_chars]
            system_message = SYSTEM_PROMPT.format(context=context)

            history = []
            for item in data.get("chat_history", []):
                if not isinstance(item, dict):
                    continue
                role = item.get("role")
                content = item.get("content", "")
                if role in {"user", "assistant"} and content:
                    history.append({"role": role, "content": str(content)})

            messages = [
                {"role": "system", "content": system_message},
                *history[-2:],
                {"role": "user", "content": query},
            ]

            llm_started = time.perf_counter()
            answer = _ollama_chat(messages, model, base_url)
            llm_ms = (time.perf_counter() - llm_started) * 1000
            print(f"[RAG] ollama_ms={llm_ms:.1f}")

            if _is_fallback(answer):
                return {
                    "answer": FALLBACK_ANSWER,
                    "source_documents": [],
                    "available": False,
                }

            return {
                "answer": answer,
                "source_documents": sources,
                "available": True,
            }

    return QAAdapter()
