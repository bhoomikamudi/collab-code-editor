import os
from datetime import datetime
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

from config import (
    AI_MOCK_MODE,
    CLIENT_URL,
    EMBEDDING_MODEL,
    OPENAI_MODEL,
    require_openai_api_key,
)
from rag_store import index_codebase, retrieve_relevant_chunks

load_dotenv()


def get_cors_origins() -> List[str]:
    origins = os.getenv("CLIENT_URL", CLIENT_URL)
    return [origin.strip() for origin in origins.split(",") if origin.strip()]


app = FastAPI(title="Collab Code Editor AI Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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


class ExplainRequest(BaseModel):
    selected_code: str = Field(..., min_length=1)
    language: str = Field(default="javascript")
    codebase_id: Optional[str] = None


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1)
    code_context: str = Field(default="")
    language: str = Field(default="javascript")
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


class ExplainResponse(BaseModel):
    explanation: str
    model: str
    language: str
    rag_chunks: List[RagChunk] = []


class ChatResponse(BaseModel):
    answer: str
    model: str
    language: str
    rag_chunks: List[RagChunk] = []


_llm_client = None


def get_llm() -> ChatOpenAI:
    global _llm_client

    if _llm_client is None:
        _llm_client = ChatOpenAI(
            model=OPENAI_MODEL,
            temperature=0.2,
            api_key=require_openai_api_key(),
        )

    return _llm_client


def ensure_real_mode_configured() -> None:
    try:
        require_openai_api_key()
    except ValueError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error


def build_rag_chunks(query: str, codebase_id: Optional[str]) -> List[RagChunk]:
    retrieved_chunks = retrieve_relevant_chunks(
        query=query,
        codebase_id=codebase_id,
        top_k=5,
    )

    return [
        RagChunk(
            filename=chunk.get("filename"),
            language=chunk.get("language"),
            start_line=chunk.get("start_line"),
            end_line=chunk.get("end_line"),
            content=chunk.get("content") or "",
        )
        for chunk in retrieved_chunks
    ]


def format_rag_context(rag_chunks: List[RagChunk]) -> str:
    if not rag_chunks:
        return "No indexed codebase context was found."

    return "\n\n".join(
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


def invoke_langchain_llm(system_prompt: str, user_prompt: str, max_tokens: int) -> str:
    llm = get_llm().bind(max_tokens=max_tokens)
    response = llm.invoke(
        [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ]
    )
    return (response.content or "").strip()


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "collab-code-editor-ai-service",
        "timestamp": datetime.utcnow().isoformat(),
        "ai_mode": "mock" if AI_MOCK_MODE else "openai",
        "chat_model": "mock-ai" if AI_MOCK_MODE else OPENAI_MODEL,
        "embedding_model": "mock-embedding" if AI_MOCK_MODE else EMBEDDING_MODEL,
        "openai_api_key_configured": not AI_MOCK_MODE,
    }


@app.post("/index", response_model=IndexResponse)
def index_codebase_endpoint(request: IndexRequest):
    if not AI_MOCK_MODE:
        ensure_real_mode_configured()

    try:
        result = index_codebase(
            codebase_id=request.codebase_id,
            files=[file_item.model_dump() for file_item in request.files],
        )

        return IndexResponse(
            codebase_id=result["codebase_id"],
            files_indexed=result["files_indexed"],
            chunks_indexed=result["chunks_indexed"],
        )

    except ValueError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Codebase indexing failed: {str(error)}",
        ) from error


@app.post("/complete", response_model=CompletionResponse)
def complete_code(request: CompletionRequest):
    before_cursor = request.code_context[: request.cursor_position]
    after_cursor = request.code_context[request.cursor_position :]

    rag_chunks = build_rag_chunks(before_cursor, request.codebase_id)

    if AI_MOCK_MODE:
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

    ensure_real_mode_configured()

    user_instruction = request.instruction or (
        "Continue the code from the cursor position. "
        "Return only the code completion. Do not explain."
    )

    prompt = f"""
Language: {request.language}

User instruction:
{user_instruction}

Relevant codebase context:
{format_rag_context(rag_chunks)}

Code before cursor:
{before_cursor}

Code after cursor:
{after_cursor}

Return only the code that should be inserted at the cursor.
Do not include markdown formatting.
"""

    try:
        completion = invoke_langchain_llm(
            system_prompt=(
                "You are a precise coding assistant. "
                "Use retrieved codebase context when helpful. "
                "Return only useful code."
            ),
            user_prompt=prompt,
            max_tokens=220,
        )

        return CompletionResponse(
            completion=completion,
            model=OPENAI_MODEL,
            language=request.language,
            rag_chunks=rag_chunks,
        )

    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"AI completion failed: {str(error)}",
        ) from error


@app.post("/explain", response_model=ExplainResponse)
def explain_code(request: ExplainRequest):
    rag_chunks = build_rag_chunks(request.selected_code, request.codebase_id)

    if AI_MOCK_MODE:
        reference = ""

        if rag_chunks:
            first_chunk = rag_chunks[0]
            reference = (
                f"\n\nRelated context: {first_chunk.filename}:"
                f"{first_chunk.start_line}-{first_chunk.end_line}"
            )

        return ExplainResponse(
            explanation=(
                "This selected code appears to define or use logic related to the "
                "current editor context. It should be reviewed for inputs, return "
                "value, and how it connects with nearby functions."
                f"{reference}"
            ),
            model="mock-ai-rag",
            language=request.language,
            rag_chunks=rag_chunks,
        )

    ensure_real_mode_configured()

    prompt = f"""
Explain the selected code clearly and concisely.

Language: {request.language}

Relevant codebase context:
{format_rag_context(rag_chunks)}

Selected code:
{request.selected_code}

Explain what it does, important inputs/outputs, and any risks or edge cases.
"""

    try:
        explanation = invoke_langchain_llm(
            system_prompt=(
                "You explain code clearly with practical engineering detail."
            ),
            user_prompt=prompt,
            max_tokens=320,
        )

        return ExplainResponse(
            explanation=explanation,
            model=OPENAI_MODEL,
            language=request.language,
            rag_chunks=rag_chunks,
        )

    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"AI explanation failed: {str(error)}",
        ) from error


@app.post("/chat", response_model=ChatResponse)
def chat_with_codebase(request: ChatRequest):
    query = f"{request.question}\n\n{request.code_context}"
    rag_chunks = build_rag_chunks(query, request.codebase_id)

    if AI_MOCK_MODE:
        if rag_chunks:
            references = ", ".join(
                [
                    f"{chunk.filename}:{chunk.start_line}-{chunk.end_line}"
                    for chunk in rag_chunks[:3]
                ]
            )

            return ChatResponse(
                answer=(
                    "Based on the indexed codebase context, the most relevant "
                    f"files are: {references}. This answer is generated in mock "
                    "RAG mode for local testing."
                ),
                model="mock-ai-rag",
                language=request.language,
                rag_chunks=rag_chunks,
            )

        return ChatResponse(
            answer=(
                "No indexed codebase context was found yet. Index files first, "
                "then ask the question again."
            ),
            model="mock-ai",
            language=request.language,
            rag_chunks=[],
        )

    ensure_real_mode_configured()

    prompt = f"""
You are answering questions about a codebase.

Language: {request.language}

Relevant codebase context:
{format_rag_context(rag_chunks)}

Current editor context:
{request.code_context}

Question:
{request.question}

Answer with practical detail. Mention file references when useful.
"""

    try:
        answer = invoke_langchain_llm(
            system_prompt=(
                "You are a codebase-aware assistant. "
                "Ground your answer in retrieved code context."
            ),
            user_prompt=prompt,
            max_tokens=420,
        )

        return ChatResponse(
            answer=answer,
            model=OPENAI_MODEL,
            language=request.language,
            rag_chunks=rag_chunks,
        )

    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Codebase chat failed: {str(error)}",
        ) from error
