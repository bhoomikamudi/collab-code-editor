import os
from datetime import datetime
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel, Field

from rag_store import index_codebase, retrieve_relevant_chunks

load_dotenv()

app = FastAPI(title="Collab Code Editor AI Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
USE_MOCK_AI = os.getenv("USE_MOCK_AI", "false").lower() == "true"

client = OpenAI(api_key=OPENAI_API_KEY)


class CodeFile(BaseModel):
    filename: str = Field(..., min_length=1)
    content: str = Field(default="")
    language: Optional[str] = None


class IndexRequest(BaseModel):
    codebase_id: str = Field(..., min_length=1)
    files: List[CodeFile] = Field(..., min_length=1)


class IndexResponse(BaseModel):
    codebase_id: str
    files_indexed: int
    chunks_indexed: int


class CompletionRequest(BaseModel):
    code_context: str = Field(..., min_length=1)
    cursor_position: int = Field(..., ge=0)
    language: str = Field(default="javascript")
    instruction: Optional[str] = None
    codebase_id: Optional[str] = None


class RagChunk(BaseModel):
    filename: Optional[str] = None
    language: Optional[str] = None
    start_line: Optional[int] = None
    end_line: Optional[int] = None
    content: str


class CompletionResponse(BaseModel):
    completion: str
    model: str
    language: str
    rag_chunks: List[RagChunk] = []


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "collab-code-editor-ai-service",
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.post("/index", response_model=IndexResponse)
def index_codebase_endpoint(request: IndexRequest):
    try:
        result = index_codebase(
            codebase_id=request.codebase_id,
            files=[file_item.model_dump() for file_item in request.files],
        )

        return IndexResponse(**result)

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Codebase indexing failed: {str(error)}",
        )


@app.post("/complete", response_model=CompletionResponse)
def complete_code(request: CompletionRequest):
    before_cursor = request.code_context[: request.cursor_position]
    after_cursor = request.code_context[request.cursor_position :]

    retrieved_chunks = retrieve_relevant_chunks(
        query=before_cursor,
        codebase_id=request.codebase_id,
        top_k=5,
    )

    rag_chunks = [
        RagChunk(
            filename=chunk.get("filename"),
            language=chunk.get("language"),
            start_line=chunk.get("start_line"),
            end_line=chunk.get("end_line"),
            content=chunk.get("content") or "",
        )
        for chunk in retrieved_chunks
    ]

    if USE_MOCK_AI:
        if rag_chunks:
            first_chunk = rag_chunks[0]
            return CompletionResponse(
                completion=(
                    " a + b; "
                    f"// RAG context: {first_chunk.filename}:"
                    f"{first_chunk.start_line}-{first_chunk.end_line}"
                ),
                model="mock-ai-rag",
                language=request.language,
                rag_chunks=rag_chunks,
            )

        return CompletionResponse(
            completion=" a + b;",
            model="mock-ai",
            language=request.language,
            rag_chunks=[],
        )

    if not OPENAI_API_KEY or OPENAI_API_KEY == "paste_your_openai_api_key_here":
        raise HTTPException(
            status_code=500,
            detail="OPENAI_API_KEY is not configured",
        )

    user_instruction = request.instruction or (
        "Continue the code from the cursor position. "
        "Return only the code completion. Do not explain."
    )

    rag_context = "\n\n".join(
        [
            (
                f"File: {chunk.filename}\n"
                f"Lines: {chunk.start_line}-{chunk.end_line}\n"
                f"Language: {chunk.language}\n"
                f"Code:\n{chunk.content}"
            )
            for chunk in rag_chunks
        ]
    )

    prompt = f"""
You are an expert software engineer helping with code completion.

Language: {request.language}

User instruction:
{user_instruction}

Relevant codebase context:
{rag_context if rag_context else "No indexed codebase context was found."}

Code before cursor:
{before_cursor}

Code after cursor:
{after_cursor}

Return only the code that should be inserted at the cursor.
Do not include markdown formatting.
"""

    try:
        response = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a precise coding assistant. "
                        "Use retrieved codebase context when helpful. "
                        "Return only useful code."
                    ),
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
            temperature=0.2,
            max_tokens=220,
        )

        completion = response.choices[0].message.content or ""

        return CompletionResponse(
            completion=completion.strip(),
            model=OPENAI_MODEL,
            language=request.language,
            rag_chunks=rag_chunks,
        )

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"AI completion failed: {str(error)}",
        )