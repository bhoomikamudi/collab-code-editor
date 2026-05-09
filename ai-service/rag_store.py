import hashlib
import os
import re
from typing import Dict, List, Optional

import chromadb

CHROMA_DB_DIR = os.getenv("CHROMA_DB_DIR", "/app/chroma_data")
COLLECTION_NAME = "codebase_chunks"
EMBEDDING_DIMENSION = 64

chroma_client = chromadb.PersistentClient(path=CHROMA_DB_DIR)
collection = chroma_client.get_or_create_collection(name=COLLECTION_NAME)


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def mock_embedding(text: str) -> List[float]:
    """
    Deterministic local embedding used for free development/testing.
    This avoids paid OpenAI embedding calls while still exercising ChromaDB.
    """
    vector = [0.0] * EMBEDDING_DIMENSION
    normalized = normalize_text(text).lower()

    for index, character in enumerate(normalized):
        bucket = (ord(character) + index) % EMBEDDING_DIMENSION
        vector[bucket] += 1.0

    magnitude = sum(value * value for value in vector) ** 0.5

    if magnitude == 0:
        return vector

    return [value / magnitude for value in vector]


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


def split_code_into_chunks(content: str, max_lines_per_chunk: int = 80) -> List[Dict]:
    """
    Splits code using simple function/class boundary patterns first.
    Falls back to line-window chunks for long blocks.
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

        for window_start in range(0, len(block_lines), max_lines_per_chunk):
            window_lines = block_lines[window_start : window_start + max_lines_per_chunk]
            chunk_text = "\n".join(window_lines).strip()

            if not chunk_text:
                continue

            chunks.append(
                {
                    "text": chunk_text,
                    "start_line": start + window_start + 1,
                    "end_line": start + window_start + len(window_lines),
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

    try:
        collection.delete(where={"codebase_id": codebase_id})
    except Exception:
        pass

    ids = []
    documents = []
    embeddings = []
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
            embeddings.append(mock_embedding(chunk["text"]))
            metadatas.append(
                {
                    "codebase_id": codebase_id,
                    "filename": filename,
                    "language": language,
                    "start_line": chunk["start_line"],
                    "end_line": chunk["end_line"],
                }
            )

    if ids:
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
    }


def retrieve_relevant_chunks(
    query: str,
    codebase_id: Optional[str] = None,
    top_k: int = 5,
) -> List[Dict]:
    where_filter = {"codebase_id": codebase_id} if codebase_id else None

    results = collection.query(
        query_embeddings=[mock_embedding(query)],
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