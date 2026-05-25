import hashlib
import os
import re
from typing import Dict, List, Optional

import chromadb
import tiktoken

from config import (
    AI_MOCK_MODE,
    CHROMA_DB_DIR,
    CHUNK_TOKEN_LIMIT,
    EMBEDDING_MODEL,
    require_openai_api_key,
)

MOCK_COLLECTION_NAME = "codebase_chunks_mock"
OPENAI_COLLECTION_NAME = "codebase_chunks_openai"
MOCK_EMBEDDING_DIMENSION = 64

_encoding = None
_embeddings_client = None
_chroma_client = None


def get_collection_name() -> str:
    return MOCK_COLLECTION_NAME if AI_MOCK_MODE else OPENAI_COLLECTION_NAME


def get_chroma_client():
    global _chroma_client

    if _chroma_client is None:
        _chroma_client = chromadb.PersistentClient(path=CHROMA_DB_DIR)

    return _chroma_client


def get_collection():
    client = get_chroma_client()
    return client.get_or_create_collection(name=get_collection_name())


def get_tiktoken_encoding():
    global _encoding

    if _encoding is None:
        _encoding = tiktoken.get_encoding("cl100k_base")

    return _encoding


def count_tokens(text: str) -> int:
    return len(get_tiktoken_encoding().encode(text or ""))


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def mock_embedding(text: str) -> List[float]:
    """Deterministic local embedding for mock mode (no OpenAI calls)."""
    vector = [0.0] * MOCK_EMBEDDING_DIMENSION
    normalized = normalize_text(text).lower()

    for index, character in enumerate(normalized):
        bucket = (ord(character) + index) % MOCK_EMBEDDING_DIMENSION
        vector[bucket] += 1.0

    magnitude = sum(value * value for value in vector) ** 0.5

    if magnitude == 0:
        return vector

    return [value / magnitude for value in vector]


def get_langchain_embeddings():
    """LangChain OpenAI embeddings used in real mode."""
    global _embeddings_client

    if _embeddings_client is None:
        from langchain_openai import OpenAIEmbeddings

        _embeddings_client = OpenAIEmbeddings(
            model=EMBEDDING_MODEL,
            openai_api_key=require_openai_api_key(),
        )

    return _embeddings_client


def embed_texts(texts: List[str]) -> List[List[float]]:
    if AI_MOCK_MODE:
        return [mock_embedding(text) for text in texts]

    return get_langchain_embeddings().embed_documents(texts)


def embed_query(text: str) -> List[float]:
    if AI_MOCK_MODE:
        return mock_embedding(text)

    return get_langchain_embeddings().embed_query(text)


def get_file_language(filename: str) -> str:
    extension_map = {
        ".js": "javascript",
        ".jsx": "javascript",
        ".ts": "typescript",
        ".tsx": "typescript",
        ".py": "python",
        ".java": "java",
        ".go": "go",
        ".cpp": "cpp",
        ".c": "c",
        ".cs": "csharp",
        ".rb": "ruby",
        ".php": "php",
        ".html": "html",
        ".css": "css",
        ".json": "json",
        ".md": "markdown",
    }

    _, extension = os.path.splitext(filename.lower())
    return extension_map.get(extension, "text")


def split_code_into_chunks(content: str, max_tokens: int = CHUNK_TOKEN_LIMIT) -> List[Dict]:
    """
    Splits code on function/class boundaries, then packs lines into token-budget chunks.
    Uses tiktoken for token counting in all modes.
    """
    lines = (content or "").splitlines()

    if not lines:
        return []

    boundary_pattern = re.compile(
        r"^\s*(def |class |function |const |let |var |async function |export function |export default|app\.)"
    )

    boundary_indexes = []

    for index, line in enumerate(lines):
        if boundary_pattern.search(line):
            boundary_indexes.append(index)

    if not boundary_indexes or boundary_indexes[0] != 0:
        boundary_indexes.insert(0, 0)

    boundary_indexes.append(len(lines))

    chunks = []

    for boundary_index in range(len(boundary_indexes) - 1):
        start = boundary_indexes[boundary_index]
        end = boundary_indexes[boundary_index + 1]
        block_lines = lines[start:end]

        current_lines = []
        current_tokens = 0
        window_start = 0

        for offset, line in enumerate(block_lines):
            line_tokens = count_tokens(line + "\n")

            if current_lines and current_tokens + line_tokens > max_tokens:
                chunk_text = "\n".join(current_lines).strip()

                if chunk_text:
                    chunks.append(
                        {
                            "text": chunk_text,
                            "start_line": start + window_start + 1,
                            "end_line": start + window_start + len(current_lines),
                            "token_count": current_tokens,
                        }
                    )

                current_lines = [line]
                current_tokens = line_tokens
                window_start = offset
                continue

            current_lines.append(line)
            current_tokens += line_tokens

        if current_lines:
            chunk_text = "\n".join(current_lines).strip()

            if chunk_text:
                chunks.append(
                    {
                        "text": chunk_text,
                        "start_line": start + window_start + 1,
                        "end_line": start + window_start + len(current_lines),
                        "token_count": current_tokens,
                    }
                )

    return chunks


def build_chunk_id(codebase_id: str, filename: str, chunk_index: int, text: str) -> str:
    digest = hashlib.sha256(
        f"{codebase_id}:{filename}:{chunk_index}:{text}".encode("utf-8")
    ).hexdigest()[:16]

    safe_filename = re.sub(r"[^a-zA-Z0-9_-]", "_", filename)

    return f"{codebase_id}_{safe_filename}_{chunk_index}_{digest}"


def index_codebase(codebase_id: str, files: List[Dict]) -> Dict:
    if not codebase_id:
        raise ValueError("codebase_id is required")

    if not files:
        raise ValueError("At least one file is required for indexing")

    collection = get_collection()

    try:
        collection.delete(where={"codebase_id": codebase_id})
    except Exception:
        pass

    ids = []
    documents = []
    metadatas = []

    for file_item in files:
        filename = file_item.get("filename") or "unknown"
        content = file_item.get("content") or ""
        language = file_item.get("language") or get_file_language(filename)

        chunks = split_code_into_chunks(content)

        for chunk_index, chunk in enumerate(chunks):
            chunk_id = build_chunk_id(
                codebase_id=codebase_id,
                filename=filename,
                chunk_index=chunk_index,
                text=chunk["text"],
            )

            ids.append(chunk_id)
            documents.append(chunk["text"])
            metadatas.append(
                {
                    "codebase_id": codebase_id,
                    "filename": filename,
                    "language": language,
                    "start_line": chunk["start_line"],
                    "end_line": chunk["end_line"],
                    "token_count": chunk.get("token_count", 0),
                }
            )

    if ids:
        embeddings = embed_texts(documents)
        collection.add(
            ids=ids,
            documents=documents,
            embeddings=embeddings,
            metadatas=metadatas,
        )

    return {
        "codebase_id": codebase_id,
        "files_indexed": len(files),
        "chunks_indexed": len(ids),
        "embedding_mode": "mock" if AI_MOCK_MODE else "openai",
        "embedding_model": "mock-embedding"
        if AI_MOCK_MODE
        else EMBEDDING_MODEL,
    }


def retrieve_relevant_chunks(
    query: str,
    codebase_id: Optional[str] = None,
    top_k: int = 5,
) -> List[Dict]:
    collection = get_collection()
    where_filter = {"codebase_id": codebase_id} if codebase_id else None

    results = collection.query(
        query_embeddings=[embed_query(query)],
        n_results=top_k,
        where=where_filter,
        include=["documents", "metadatas", "distances"],
    )

    documents = results.get("documents", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]
    distances = results.get("distances", [[]])[0]

    chunks = []

    for index, document in enumerate(documents):
        metadata = metadatas[index] if index < len(metadatas) else {}
        distance = distances[index] if index < len(distances) else None

        chunks.append(
            {
                "content": document,
                "filename": metadata.get("filename"),
                "language": metadata.get("language"),
                "start_line": metadata.get("start_line"),
                "end_line": metadata.get("end_line"),
                "distance": distance,
            }
        )

    return chunks
