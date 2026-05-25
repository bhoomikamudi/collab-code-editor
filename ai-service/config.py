import os

from dotenv import load_dotenv

load_dotenv()

OPENAI_API_KEY = (os.getenv("OPENAI_API_KEY") or "").strip()
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
CHROMA_DB_DIR = os.getenv("CHROMA_DB_DIR", "/app/chroma_data")
CHUNK_TOKEN_LIMIT = int(os.getenv("CHUNK_TOKEN_LIMIT", "500"))
CLIENT_URL = os.getenv("CLIENT_URL", "http://localhost:3000")

INVALID_API_KEY_PLACEHOLDERS = {
    "",
    "paste_your_openai_api_key_here",
    "mock_key_for_local_testing",
}


def _parse_bool(value: str) -> bool:
    return value.strip().lower() in {"1", "true", "yes", "on"}


def resolve_mock_mode() -> bool:
    """
    Mock mode when explicitly enabled, or when no valid OpenAI key is configured.
    AI_MOCK_MODE takes precedence over legacy USE_MOCK_AI.
    """
    if os.getenv("AI_MOCK_MODE") is not None:
        return _parse_bool(os.getenv("AI_MOCK_MODE", "true"))

    if os.getenv("USE_MOCK_AI") is not None:
        return _parse_bool(os.getenv("USE_MOCK_AI", "true"))

    return OPENAI_API_KEY in INVALID_API_KEY_PLACEHOLDERS


AI_MOCK_MODE = resolve_mock_mode()


def require_openai_api_key() -> str:
    if AI_MOCK_MODE:
        return OPENAI_API_KEY

    if OPENAI_API_KEY in INVALID_API_KEY_PLACEHOLDERS:
        raise ValueError(
            "OPENAI_API_KEY is required when AI_MOCK_MODE=false. "
            "Set AI_MOCK_MODE=true for local development without a paid API key."
        )

    return OPENAI_API_KEY
