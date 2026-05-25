import hashlib
import os
import re
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

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


@dataclass
class CodeBoundary:
    line_index: int
    chunk_type: str
    symbol_name: str


# Best-effort regex boundary detection (not full AST parsing).
BOUNDARY_RULES: Dict[str, List[Tuple[str, re.Pattern]]] = {
    "python": [
        ("class", re.compile(r"^\s*class\s+([A-Za-z_]\w*)")),
        ("function", re.compile(r"^\s*async\s+def\s+([A-Za-z_]\w*)")),
        ("function", re.compile(r"^\s*def\s+([A-Za-z_]\w*)")),
    ],
    "javascript": [
        ("class", re.compile(r"^\s*(?:export\s+)?class\s+([A-Za-z_$][\w$]*)")),
        (
            "function",
            re.compile(
                r"^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)"
            ),
        ),
        (
            "function",
            re.compile(
                r"^\s*export\s+default\s+(?:async\s+)?function\s*([A-Za-z_$][\w$]*)?"
            ),
        ),
        (
            "function",
            re.compile(
                r"^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?function\b"
            ),
        ),
        (
            "function",
            re.compile(
                r"^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*async\s*\("
            ),
        ),
        (
            "function",
            re.compile(
                r"^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\([^)]*\)\s*=>"
            ),
        ),
        (
            "function",
            re.compile(
                r"^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*async\s+"
            ),
        ),
    ],
    "java": [
        ("class", re.compile(r"^\s*(?:public\s+|private\s+|protected\s+)?(?:abstract\s+)?class\s+(\w+)")),
        (
            "method",
            re.compile(
                r"^\s*(?:public|private|protected|static|\s)+[\w<>\[\],\s.?]+\s+(\w+)\s*\([^)]*\)\s*(?:throws\s+[\w,\s]+)?\s*\{"
            ),
        ),
        ("method", re.compile(r"^\s*(?:public|private|protected|static|\s)+\s*(\w+)\s*\([^)]*\)\s*\{")),
    ],
    "go": [
        ("function", re.compile(r"^\s*func\s+(?:\([^)]+\)\s+)?([A-Za-z_]\w*)")),
    ],
    "generic": [
        ("class", re.compile(r"^\s*class\s+([A-Za-z_]\w*)")),
        ("function", re.compile(r"^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)")),
        ("function", re.compile(r"^\s*def\s+([A-Za-z_]\w*)")),
        ("function", re.compile(r"^\s*func\s+([A-Za-z_]\w*)")),
    ],
}


def get_collection_name() -> str:
    return MOCK_COLLECTION_NAME if AI_MOCK_MODE else OPENAI_COLLECTION_NAME


def get_chroma_client():
    global _chroma_client

    if _chroma_client is None:
        import chromadb

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


def resolve_language_family(language: str) -> str:
    if language in {"javascript", "typescript"}:
        return "javascript"
    if language == "python":
        return "python"
    if language == "java":
        return "java"
    if language == "go":
        return "go"
    return "generic"


def match_boundary(line: str, language: str) -> Optional[CodeBoundary]:
    rules = BOUNDARY_RULES.get(resolve_language_family(language), BOUNDARY_RULES["generic"])

    for chunk_type, pattern in rules:
        match = pattern.search(line)
        if not match:
            continue

        symbol_name = ""
        if match.lastindex and match.group(1):
            symbol_name = match.group(1)
        elif "export default" in line and "function" in line:
            symbol_name = "defaultExport"
        elif chunk_type == "class":
            class_match = re.search(r"class\s+([A-Za-z_]\w*)", line)
            symbol_name = class_match.group(1) if class_match else "AnonymousClass"

        return CodeBoundary(
            line_index=0,
            chunk_type=chunk_type,
            symbol_name=symbol_name or chunk_type,
        )

    return None


def detect_boundaries(lines: List[str], language: str) -> List[CodeBoundary]:
    boundaries: List[CodeBoundary] = []

    for index, line in enumerate(lines):
        matched = match_boundary(line, language)
        if matched:
            boundaries.append(
                CodeBoundary(
                    line_index=index,
                    chunk_type=matched.chunk_type,
                    symbol_name=matched.symbol_name,
                )
            )

    if not boundaries or boundaries[0].line_index != 0:
        boundaries.insert(
            0,
            CodeBoundary(line_index=0, chunk_type="fallback", symbol_name="file_start"),
        )

    return boundaries


def pack_lines_with_token_budget(
    lines: List[str],
    absolute_start_line: int,
    chunk_type: str,
    symbol_name: str,
    max_tokens: int,
) -> List[Dict]:
    if not lines:
        return []

    chunks: List[Dict] = []
    current_lines: List[str] = []
    current_tokens = 0
    window_start_offset = 0
    part_index = 0

    for offset, line in enumerate(lines):
        line_tokens = count_tokens(line + "\n")

        if current_lines and current_tokens + line_tokens > max_tokens:
            chunk_text = "\n".join(current_lines).strip()
            if chunk_text:
                part_type = chunk_type if part_index == 0 else "block"
                chunks.append(
                    {
                        "text": chunk_text,
                        "start_line": absolute_start_line + window_start_offset,
                        "end_line": absolute_start_line + window_start_offset + len(current_lines) - 1,
                        "token_count": current_tokens,
                        "chunk_type": part_type,
                        "symbol_name": symbol_name,
                    }
                )
                part_index += 1

            current_lines = [line]
            current_tokens = line_tokens
            window_start_offset = offset
            continue

        current_lines.append(line)
        current_tokens += line_tokens

    if current_lines:
        chunk_text = "\n".join(current_lines).strip()
        if chunk_text:
            part_type = chunk_type if part_index == 0 else "block"
            chunks.append(
                {
                    "text": chunk_text,
                    "start_line": absolute_start_line + window_start_offset,
                    "end_line": absolute_start_line + window_start_offset + len(current_lines) - 1,
                    "token_count": current_tokens,
                    "chunk_type": part_type,
                    "symbol_name": symbol_name,
                }
            )

    return chunks


def split_code_into_chunks(
    content: str,
    max_tokens: int = CHUNK_TOKEN_LIMIT,
    language: str = "text",
) -> List[Dict]:
    """
    Split source code on language-aware function/class boundaries (regex best-effort),
    then enforce tiktoken token budgets. Falls back to file-level blocks when no
    structure is detected.
    """
    lines = (content or "").splitlines()

    if not lines:
        return []

    boundaries = detect_boundaries(lines, language)
    boundary_indexes = [boundary.line_index for boundary in boundaries]
    boundary_indexes.append(len(lines))

    # Pure fallback when only file_start boundary exists and no structural matches.
    structural_boundaries = [
        boundary
        for boundary in boundaries
        if boundary.chunk_type != "fallback" or boundary.symbol_name != "file_start"
    ]
    has_structure = len(structural_boundaries) > 1 or any(
        boundary.chunk_type in {"function", "class", "method"} for boundary in boundaries
    )

    if not has_structure:
        return pack_lines_with_token_budget(
            lines=lines,
            absolute_start_line=1,
            chunk_type="fallback",
            symbol_name="file",
            max_tokens=max_tokens,
        )

    chunks: List[Dict] = []

    for boundary_index in range(len(boundary_indexes) - 1):
        start = boundary_indexes[boundary_index]
        end = boundary_indexes[boundary_index + 1]
        block_lines = lines[start:end]

        if not block_lines:
            continue

        boundary_meta = boundaries[boundary_index]
        block_chunks = pack_lines_with_token_budget(
            lines=block_lines,
            absolute_start_line=start + 1,
            chunk_type=boundary_meta.chunk_type,
            symbol_name=boundary_meta.symbol_name,
            max_tokens=max_tokens,
        )
        chunks.extend(block_chunks)

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

        chunks = split_code_into_chunks(content, language=language)

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
                    "start_line": int(chunk["start_line"]),
                    "end_line": int(chunk["end_line"]),
                    "token_count": int(chunk.get("token_count", 0)),
                    "chunk_type": str(chunk.get("chunk_type", "fallback")),
                    "symbol_name": str(chunk.get("symbol_name", "")),
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


def run_chunking_self_test() -> None:
    """Lightweight mock-mode chunking report for local validation."""
    samples = [
        {
            "name": "javascript",
            "language": "javascript",
            "content": (
                "export function add(a, b) {\n"
                "  return a + b;\n"
                "}\n\n"
                "export const multiply = (x, y) => x * y;\n\n"
                "class Calculator {\n"
                "  subtract(value) {\n"
                "    return value - 1;\n"
                "  }\n"
                "}\n"
            ),
        },
        {
            "name": "python",
            "language": "python",
            "content": (
                "class Greeter:\n"
                "    def hello(self):\n"
                "        return 'hi'\n\n"
                "def add(a, b):\n"
                "    return a + b\n"
            ),
        },
        {
            "name": "fallback",
            "language": "text",
            "content": "plain text\nwithout code boundaries\nsecond line\n",
        },
    ]

    print("Code-aware chunking self-test")
    for sample in samples:
        chunks = split_code_into_chunks(sample["content"], language=sample["language"])
        print(f"\n[{sample['name']}] chunks={len(chunks)}")
        for chunk in chunks:
            print(
                f"  {chunk['chunk_type']}:{chunk['symbol_name']} "
                f"L{chunk['start_line']}-{chunk['end_line']} "
                f"tokens={chunk['token_count']}"
            )


if __name__ == "__main__":
    run_chunking_self_test()
