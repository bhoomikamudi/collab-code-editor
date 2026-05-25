# Deployment Guide

This project supports two Docker Compose modes:

| Mode | File | Purpose |
|------|------|---------|
| Local development | `docker-compose.yml` | Hot reload, direct ports (`3000`, `5000`, `8000`) |
| Production-style | `docker-compose.prod.yml` | Built images, nginx reverse proxy, internal services |

This guide prepares a production-style deployment. It does **not** assume a live hosted URL exists yet.

## Architecture (production-style)

```text
Browser
   |
   | HTTP / WebSocket (port 80 by default)
   v
nginx
   |-- /                 React production build (Vite static files)
   |-- /auth             Node backend
   |-- /documents        Node backend
   |-- /ai               Node backend (AI proxy)
   |-- /health           Node backend health
   |-- /ai-service/health AI service health (ops)
   |-- /ws               WebSocket upgrade -> Node backend

Node backend ---- PostgreSQL
              \--- Redis
              \--- FastAPI AI service (internal)
```

## Required environment variables

Copy the production template:

```bash
cp deploy/env.prod.example .env
```

Edit `.env` before starting the stack.

### Core secrets and connections

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Yes | Long random secret for signing auth tokens |
| `POSTGRES_USER` | Yes | PostgreSQL username |
| `POSTGRES_PASSWORD` | Yes | PostgreSQL password |
| `POSTGRES_DB` | Yes | PostgreSQL database name |
| `DATABASE_URL` | Yes | Full Postgres URL, e.g. `postgresql://user:pass@postgres:5432/dbname` |
| `REDIS_URL` | Yes | Redis URL, e.g. `redis://redis:6379` |
| `CLIENT_URL` | Yes | Public browser origin for CORS (e.g. `http://localhost` or `https://your-domain.example`) |

### Backend / proxy

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_EXPIRES_IN` | No | `7d` | JWT expiry |
| `AI_SERVICE_URL` | Set in compose | `http://ai-service:8000` | Internal AI service URL (Node proxy) |
| `NGINX_HTTP_PORT` | No | `80` | Host port for nginx |

### AI service

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | No | empty | Optional OpenAI key for real model calls |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | Completion/chat model |
| `EMBEDDING_MODEL` | No | `text-embedding-3-small` | Embedding model for RAG |
| `AI_MOCK_MODE` | No | `true` | `true` = mock LLM/embeddings (no key); `false` requires `OPENAI_API_KEY` for real OpenAI via LangChain |
| `USE_MOCK_AI` | No | — | Legacy alias for `AI_MOCK_MODE` |

### Optional frontend build overrides

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_BASE_URL` | No | empty | Leave empty to use same-origin REST through nginx |
| `VITE_WS_URL` | No | empty | Leave empty to use same-origin `/ws` WebSocket path |

## Production-style startup

From the repository root:

```bash
cp deploy/env.prod.example .env
# edit .env with secure values

docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml run --rm server npm run init-db
```

Stop the stack:

```bash
docker compose -f docker-compose.prod.yml down
```

## Routes and health checks

Replace `HOST` with your server hostname or IP (for example `localhost` during a local prod-style test).

### Frontend

```text
http://HOST/
```

Serves the built React app through nginx.

### Backend health

Direct (local dev compose only):

```text
http://HOST:5000/health
```

Through nginx (production-style compose):

```text
http://HOST/health
```

Expected JSON shape:

```json
{
  "status": "ok",
  "service": "collab-code-editor-server",
  "timestamp": "..."
}
```

### AI service health

Direct (local dev compose only):

```text
http://HOST:8000/health
```

Through nginx (production-style compose):

```text
http://HOST/ai-service/health
```

Expected JSON shape:

```json
{
  "status": "ok",
  "service": "collab-code-editor-ai-service",
  "timestamp": "..."
}
```

### WebSocket collaboration

Local development (`docker-compose.yml`):

```text
ws://HOST:5000
```

Production-style (`docker-compose.prod.yml` through nginx):

```text
ws://HOST/ws
```

With TLS terminated in front of nginx, use:

```text
wss://HOST/ws
```

The frontend automatically uses `/ws` on the same host in production builds unless `VITE_WS_URL` is set at build time.

## Local development (unchanged)

Continue using the original compose file for hot reload:

```bash
cp server/.env.example server/.env
cp ai-service/.env.example ai-service/.env
# edit secrets if needed

docker compose up -d --build
docker compose run --rm server npm run init-db
```

Local URLs:

```text
Frontend:   http://localhost:3000
Backend:    http://localhost:5000/health
AI service: http://localhost:8000/health
WebSocket:  ws://localhost:5000
```

## TLS / public domain notes

This repository ships an HTTP nginx config on port 80. For a public deployment:

1. Point your domain DNS to the host running Docker.
2. Set `CLIENT_URL` to your public origin (for example `https://your-domain.example`).
3. Terminate TLS with your platform load balancer or extend nginx with certificates (Let's Encrypt, managed certs, etc.).
4. Rebuild nginx if you change `VITE_*` build-time values.

Do not commit real `.env` files or API keys.

## Files added for deployment

```text
docker-compose.prod.yml      Production-style compose stack
deploy/env.prod.example      Root .env template for prod compose
deploy/nginx/Dockerfile      Builds frontend + nginx image
deploy/nginx/default.conf    Reverse proxy routes and WebSocket upgrade
server/Dockerfile.prod       Production Node backend image
ai-service/Dockerfile.prod   Production FastAPI image
client/.env.example          Optional Vite env overrides
```
