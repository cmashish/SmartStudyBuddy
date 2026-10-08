import os
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_openai import ChatOpenAI


SYSTEM_PROMPT = """You are Smart Study Buddy, an AI study assistant.

Answer the student's question using the provided lecture-note context.

Rules:
1. Prefer information from the supplied lecture-note context.
2. Do not invent facts.
3. If the answer is not supported by the context, say exactly:
   "I'm sorry, but I couldn't find information about that in your lecture notes."
4. Explain answers clearly and in a student-friendly way.

Lecture-note context:
{context}
"""


def _format_documents(documents: list[Any]) -> str:
    if not documents:
        return "No relevant lecture-note context was found."

    parts = []
    for document in documents:
        metadata = document.metadata or {}
        source = metadata.get("source", "unknown")
        page = metadata.get("page")
        page_text = f", page {page + 1}" if isinstance(page, int) else ""
        parts.append(
            f"Source: {source}{page_text}\n{document.page_content}"
        )

    return "\n\n---\n\n".join(parts)


def _to_chat_messages(history: list[Any]) -> list[Any]:
    """Convert stored session messages into LangChain message objects."""
    messages = []

    for item in history:
        if isinstance(item, dict):
            role = item.get("role")
            content = item.get("content", "")
        else:
            continue

        if not content:
            continue

        if role == "user":
            messages.append(HumanMessage(content=content))
        elif role == "assistant":
            messages.append(AIMessage(content=content))

    return messages


def create_qa_chain(vectorstore):
    if vectorstore is None:
        raise ValueError("vectorstore cannot be None")

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY is not set")

    llm = ChatOpenAI(
        model=os.getenv("CHAT_MODEL", "gpt-4o-mini"),
        temperature=0,
        api_key=api_key,
    )

    retriever = vectorstore.as_retriever(
        search_type="similarity",
        search_kwargs={"k": int(os.getenv("RETRIEVAL_K", "3"))},
    )

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", SYSTEM_PROMPT),
            MessagesPlaceholder(variable_name="chat_history", optional=True),
            ("human", "{input}"),
        ]
    )

    class QAAdapter:
        def invoke(self, data):
            if not isinstance(data, dict):
                raise TypeError("QA input must be a dictionary")

            query = str(data.get("input", "")).strip()
            if not query:
                raise ValueError("input cannot be empty")

            history = data.get("chat_history", [])
            docs = retriever.invoke(query)
            context = _format_documents(docs)
            messages = _to_chat_messages(history)

            # Build and invoke the prompt explicitly. This avoids the fragile
            # dict | prompt | llm expression that caused the Runnable error.
            prompt_value = prompt.invoke(
                {
                    "context": context,
                    "chat_history": messages,
                    "input": query,
                }
            )

            response = llm.invoke(prompt_value)
            answer = response.content

            if isinstance(answer, list):
                answer = "".join(
                    str(part.get("text", part)) if isinstance(part, dict) else str(part)
                    for part in answer
                )

            return {
                "answer": str(answer),
                "source_documents": docs,
            }

    return QAAdapter()
