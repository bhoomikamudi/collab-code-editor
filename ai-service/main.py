import os
from datetime import datetime
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel, Field

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


class CompletionRequest(BaseModel):
    code_context: str = Field(..., min_length=1)
    cursor_position: int = Field(..., ge=0)
    language: str = Field(default="javascript")
    instruction: Optional[str] = None


class CompletionResponse(BaseModel):
    completion: str
    model: str
    language: str


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "collab-code-editor-ai-service",
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.post("/complete", response_model=CompletionResponse)
def complete_code(request: CompletionRequest):
    if USE_MOCK_AI:
        return CompletionResponse(
            completion=" a + b;",
            model="mock-ai",
            language=request.language,
        )

    if not OPENAI_API_KEY or OPENAI_API_KEY == "paste_your_openai_api_key_here":
        raise HTTPException(
            status_code=500,
            detail="OPENAI_API_KEY is not configured",
        )

    before_cursor = request.code_context[: request.cursor_position]
    after_cursor = request.code_context[request.cursor_position :]

    user_instruction = request.instruction or (
        "Continue the code from the cursor position. "
        "Return only the code completion. Do not explain."
    )

    prompt = f"""
You are an expert software engineer helping with code completion.

Language: {request.language}

User instruction:
{user_instruction}

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
                    "content": "You are a precise coding assistant. Return only useful code.",
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
            temperature=0.2,
            max_tokens=180,
        )

        completion = response.choices[0].message.content or ""

        return CompletionResponse(
            completion=completion.strip(),
            model=OPENAI_MODEL,
            language=request.language,
        )

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"AI completion failed: {str(error)}",
        )