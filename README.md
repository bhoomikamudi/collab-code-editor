# Collab Code Editor (Project A)

A full-stack, real-time collaborative code editor with JWT authentication, operational transformation (OT), Redis-backed sync, document version history, and an AI assistant powered by RAG indexing over your open file.

Built as a portfolio-grade **Project A** system: separate React frontend, Node/Express backend, FastAPI AI microservice, PostgreSQL, Redis, Docker Compose, GitHub Actions CI, and deployment-ready nginx configuration.

> **Status:** Fully runnable locally via Docker Compose. Production-style deployment configuration is included; this README does **not** claim a public live deployment unless you have hosted one yourself.

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Operational transformation](#operational-transformation)
- [Redis: history, presence, and pub/sub](#redis-history-presence-and-pubsub)
- [AI and RAG flow](#ai-and-rag-flow)
- [Version history](#version-history)
- [Local setup](#local-setup)
- [Environment variables](#environment-variables)
- [API and WebSocket](#api-and-websocket)
- [Testing](#testing)
- [GitHub Actions CI](#github-actions-ci)
- [Deployment](#deployment)
- [Documentation](#documentation)
- [Honest limitations](#honest-limitations)
- [Future improvements](#future-improvements)

---

## Features

### Core editor and collaboration

- User **register / login** with JWT
- **Document dashboard**: create, list, select, delete
- **CodeMirror** editor with line numbers and dark theme
- **WebSocket** real-time sync for insert/delete edits
- **Operational transformation** (ot.js) on the server for concurrent edits
- **Revision counter** and Redis-backed operation history
- **Cursor presence** with Redis TTL cleanup
- **Redis pub/sub** so multiple Node instances can broadcast collaboration events

### AI assistant

- **Index for RAG** — chunk and embed the current file in ChromaDB
- **AI Complete** — inline completion with optional RAG context
- **Explain Selection** — natural-language explanation of highlighted code
- **Codebase Chat** — Q&A grounded in indexed chunks
- **RAG references** — filenames and line ranges shown in the UI
- **Mock AI mode** — local demos without a paid OpenAI key

### Persistence and history

- PostgreSQL for users, documents, collaborators, and **snapshots**
- Automatic snapshot every **50 operations**
- **Load History** and **Restore** snapshot workflow

### Engineering

- **Axios** REST client with JWT interceptor
- **Tailwind CSS** polished dark UI
- **Docker Compose** local development with hot reload
- **GitHub Actions** CI (build + syntax checks)
- **docker-compose.prod.yml** + nginx reverse proxy — see [DEPLOYMENT.md](./DEPLOYMENT.md)

---

## Tech stack

| Layer | Technologies |
|-------|----------------|
| Frontend | React 18, Vite, Tailwind CSS, CodeMirror, Axios, WebSocket |
| Backend | Node.js, Express, ws, jsonwebtoken, bcryptjs, pg, ot.js |
| Data | PostgreSQL 16 (users, documents, snapshots) |
| Cache / sync | Redis 7 (operation lists, presence hashes, pub/sub channel) |
| AI service | Python 3.11, FastAPI, OpenAI SDK, LangChain, ChromaDB |
| DevOps | Docker, Docker Compose, GitHub Actions, nginx (prod-style) |

---

## Architecture

### Repository layout

```text
collab-code-editor/
├── client/              React + Vite + Tailwind frontend
├── server/              Express REST API + WebSocket + OT engine
├── ai-service/          FastAPI + ChromaDB RAG service
├── deploy/              nginx config and prod env template
├── .github/workflows/   CI pipeline
├── docs/                Demo script, API reference, screenshot checklist
├── docker-compose.yml   Local development (hot reload)
└── docker-compose.prod.yml   Production-style stack (nginx)
```

### System diagram

```text
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (React)                          │
│  CodeMirror │ Axios REST │ WebSocket client                     │
└─────────────┬───────────────────────┬───────────────────────────┘
              │ HTTP                  │ WS
              ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Node.js / Express (server)                    │
│  /auth  /documents  /ai (proxy)  │  WebSocket rooms + OT        │
│  JWT middleware                  │  Redis pub/sub fan-out      │
└──────┬──────────────┬────────────┴──────────────┬───────────────┘
       │ SQL          │ Redis                     │ HTTP (internal)
       ▼              ▼                           ▼
┌────────────┐  ┌────────────┐            ┌──────────────────┐
│ PostgreSQL │  │   Redis    │            │ FastAPI AI       │
│ users      │  │ op history │            │ /index /complete │
│ documents  │  │ presence   │            │ /explain /chat   │
│ snapshots  │  │ pub/sub    │            │ ChromaDB RAG     │
└────────────┘  └────────────┘            └──────────────────┘
```

### Request paths (local dev)

| Traffic | Route |
|---------|--------|
| Frontend UI | `http://localhost:3000` |
| REST API | `http://localhost:5000` |
| WebSocket | `ws://localhost:5000` |
| AI service (direct, optional) | `http://localhost:8000` |

The frontend normally calls **Node `/ai/*`** routes; the backend proxies to FastAPI.

---

## Operational transformation

This project uses **prototype-level OT**, not full Google Docs–grade CRDT editing.

1. The client sends a simple **insert** or **delete** operation with its last known **revision**.
2. The server loads operations from Redis **since that revision**.
3. **ot.js** transforms the incoming operation against concurrent history.
4. The server applies the result to PostgreSQL document content and appends to Redis history.
5. Peers receive a `REMOTE_OPERATION` with the transformed edit and updated revision.
6. The originating client receives `OPERATION_ACK`.

**Honest scope:** Replace-style edits from the UI are not synced yet; insert/delete are the supported collaborative paths. Conflict handling is suitable for demos and learning, not unlimited concurrent complexity.

---

## Redis: history, presence, and pub/sub

| Redis use | Key pattern | Purpose |
|-----------|-------------|---------|
| Operation history | `doc:{id}:ops` (list) | Ordered OT operation log; revision = list length |
| Presence | `doc:{id}:presence` (hash, TTL 30s) | Active users and cursor positions |
| Pub/sub | `collab:websocket:events` | Fan-out `REMOTE_OPERATION`, `CURSOR_UPDATE`, `USER_JOINED`, `USER_LEFT` across Node instances |

**Local dev:** A single Node server still uses pub/sub; events from the same instance are ignored via `serverInstanceId` to prevent echo loops.

**Horizontal scaling:** Multiple backend containers can share Redis so WebSocket events reach clients on other instances. Full multi-instance load testing is optional; single-instance Docker Compose is the primary demo path.

---

## AI and RAG flow

```text
1. User clicks "Index for RAG"
   → POST /ai/index (Node) → POST /index (FastAPI)
   → File chunked → embeddings stored in ChromaDB (per codebase_id)

2. User runs Complete / Explain / Chat
   → Node proxy → FastAPI retrieves top-k chunks from ChromaDB
   → Prompt built with code context + RAG snippets
   → OpenAI API OR mock response (USE_MOCK_AI=true)

3. UI shows answer + RAG reference filenames/lines
```

**codebase_id** format: `user-{userId}-document-{documentId}` — ties the index to the open document.

---

## Version history

- Every applied WebSocket operation increments the revision in Redis.
- When `revision % 50 === 0`, the server writes a **snapshot** to PostgreSQL (content preview + metadata).
- **Load History** fetches snapshots via `GET /documents/:id/history`.
- **Restore** calls `POST /documents/:id/restore/:snapshotId` and reloads editor content.

---

## Local setup

### Prerequisites

- Docker Desktop (or Docker Engine + Compose v2)
- Git

### 1. Clone

```bash
git clone <your-repository-url>
cd collab-code-editor
```

### 2. Environment files

```bash
cp server/.env.example server/.env
cp ai-service/.env.example ai-service/.env
```

Edit `server/.env` — at minimum set a strong `JWT_SECRET`:

```env
PORT=5000
CLIENT_URL=http://localhost:3000
DATABASE_URL=postgresql://collab_user:collab_password@postgres:5432/collab_code_editor
REDIS_URL=redis://redis:6379
JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN=7d
AI_SERVICE_URL=http://ai-service:8000
```

Edit `ai-service/.env`:

```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
EMBEDDING_MODEL=text-embedding-3-small
CHROMA_DB_DIR=/app/chroma_data
USE_MOCK_AI=true
```

For real OpenAI calls: set a valid `OPENAI_API_KEY` and `USE_MOCK_AI=false`.

### 3. Start services

```bash
docker compose up -d --build
```

### 4. Initialize database schema

```bash
docker compose run --rm server npm run init-db
```

### 5. Open the app

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend health | http://localhost:5000/health |
| AI health | http://localhost:8000/health |

### 6. Demo account (optional)

Register in the UI, or use credentials you created during development, for example:

```text
Email: test@example.com
Password: password123
```

---

## Environment variables

| File | Variables |
|------|-----------|
| `server/.env` | `PORT`, `CLIENT_URL`, `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `AI_SERVICE_URL` |
| `ai-service/.env` | `OPENAI_API_KEY`, `OPENAI_MODEL`, `EMBEDDING_MODEL`, `CHROMA_DB_DIR`, `USE_MOCK_AI` |
| `client/.env` (optional) | `VITE_API_BASE_URL`, `VITE_WS_URL` — defaults work for local Docker |

Production-style variables: see [deploy/env.prod.example](./deploy/env.prod.example) and [DEPLOYMENT.md](./DEPLOYMENT.md).

---

## API and WebSocket

### REST (summary)

| Group | Endpoints |
|-------|-----------|
| Health | `GET /health` |
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| Documents | `POST/GET/DELETE /documents`, `GET /documents/:id`, `GET /documents/:id/history`, `POST /documents/:id/restore/:snapshotId` |
| AI proxy | `POST /ai/index`, `POST /ai/complete`, `POST /ai/explain`, `POST /ai/chat` |

Full reference: [docs/API.md](./docs/API.md)

### WebSocket

**URL (local):** `ws://localhost:5000`

| Client → server | Server → client |
|-----------------|-----------------|
| `JOIN_DOCUMENT` | `CONNECTED`, `DOCUMENT_JOINED` |
| `OPERATION` | `OPERATION_ACK`, `REMOTE_OPERATION` |
| `CURSOR` | `CURSOR_ACK`, `CURSOR_UPDATE` |
| — | `USER_JOINED`, `USER_LEFT`, `ERROR` |

---

## Testing

### Manual UI test

Follow [docs/DEMO_SCRIPT.md](./docs/DEMO_SCRIPT.md) for a 3-minute walkthrough (login, two-tab sync, AI, history restore).

### WebSocket smoke test

After login, create a document and copy its ID and JWT from browser devtools or API:

```bash
docker compose run --rm server npm run test-ws -- <documentId> <jwtToken>
```

Expect `OPERATION_ACK` and `CURSOR_ACK` in the output.

### Health checks

```bash
curl http://localhost:5000/health
curl http://localhost:8000/health
```

### Frontend production build (without Docker)

```bash
cd client
npm ci
npm run build
```

---

## GitHub Actions CI

Workflow: [.github/workflows/ci.yml](./.github/workflows/ci.yml)

Runs on **pull requests** and **pushes to `main`**:

| Job | What it does |
|-----|----------------|
| Frontend build | `npm ci` + `npm run build` in `client/` |
| Backend syntax check | `npm ci` + `npm run check` (`node --check` on core server files) |
| AI service syntax check | `pip install -r requirements.txt` + `py_compile` on `main.py`, `rag_store.py` |

No Docker, secrets, or live API keys are required in CI.

---

## Deployment

Local development uses `docker-compose.yml` (hot reload, ports 3000/5000/8000).

Production-style configuration (nginx reverse proxy, built images, env-based secrets) is documented in **[DEPLOYMENT.md](./DEPLOYMENT.md)**.

Quick start:

```bash
cp deploy/env.prod.example .env
# edit secrets
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml run --rm server npm run init-db
```

---

## Documentation

| Doc | Description |
|-----|-------------|
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Production-style Docker + nginx |
| [docs/API.md](./docs/API.md) | REST and WebSocket reference |
| [docs/DEMO_SCRIPT.md](./docs/DEMO_SCRIPT.md) | 3-minute recruiter demo script |
| [docs/SCREENSHOTS.md](./docs/SCREENSHOTS.md) | Screenshot/GIF capture checklist |

---

## Honest limitations

- **OT scope:** Insert/delete collaborative sync is implemented; replace operations from the UI are not synced. This is a strong prototype, not production-grade concurrent editing at Google Docs scale.
- **AI:** Mock mode is the default for free local demos. Real OpenAI usage requires configuration and may incur cost.
- **RAG:** Indexing is per-document session workflow (current file), not a full multi-repo ingestion pipeline.
- **Deployment:** Configuration is provided; a public URL is only accurate if you deploy it yourself.
- **Testing:** CI runs build/syntax checks, not a full end-to-end browser test suite.

---

## Future improvements

- Sync replace operations and strengthen OT/CRDT coverage
- Collaborator invite and share links
- Multi-file / multi-repo RAG indexing
- E2E tests (Playwright) for auth, sync, and AI flows
- TLS-terminated nginx examples and hosted demo environment
- Language selector beyond JavaScript defaults

---

## License

Add your license here if open-sourcing the portfolio project.
