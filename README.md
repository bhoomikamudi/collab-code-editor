# Real-Time Collaborative Code Editor with AI Assistance

A full-stack collaborative code editor that supports user authentication, document management, real-time editing, cursor presence, revision tracking, and AI-assisted code completion.

This project is built as a production-style full-stack system with separate frontend, backend, AI service, PostgreSQL, Redis, and Docker-based local orchestration.

## Features

- User registration and login with JWT authentication
- Protected document dashboard
- Create, list, view, and delete coding documents
- CodeMirror-based browser code editor
- WebSocket-based real-time document editing
- Redis-backed operation history and revision tracking
- Basic Operational Transformation flow for insert/delete operations
- Real-time cursor presence with Redis TTL cleanup
- FastAPI AI service for code completion
- Backend AI proxy route so the frontend calls the Node backend instead of directly calling the AI service
- Mock AI mode for local testing without paid API usage
- Docker Compose setup for frontend, backend, AI service, PostgreSQL, and Redis

## Tech Stack

### Frontend

- React
- Vite
- CodeMirror
- JavaScript
- WebSocket client
- Fetch API

### Backend

- Node.js
- Express.js
- PostgreSQL
- Redis
- JWT authentication
- WebSocket server

### AI Service

- Python
- FastAPI
- OpenAI SDK
- Mock AI fallback mode
- LangChain and ChromaDB dependencies prepared for future RAG expansion

### Infrastructure

- Docker
- Docker Compose
- PostgreSQL container
- Redis container

## Project Architecture

```text
client/        React frontend with CodeMirror editor and dashboard
server/        Node.js backend for auth, documents, WebSocket sync, and AI proxy
ai-service/    FastAPI service for AI code completion
postgres       Stores users, documents, and collaborator metadata
redis          Stores operation history and cursor presence
```

High-level flow:

```text
React Frontend
   |
   | REST API + WebSocket
   v
Node.js Backend
   |
   | SQL
   v
PostgreSQL

Node.js Backend
   |
   | Redis operations / presence
   v
Redis

Node.js Backend
   |
   | Internal HTTP call
   v
FastAPI AI Service
```

## Local Setup

### 1. Clone the repository

```bash
git clone <your-repository-url>
cd collab-code-editor
```

### 2. Create environment files

Create `server/.env`:

```env
PORT=5000
CLIENT_URL=http://localhost:3000
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/collab_code_editor
REDIS_URL=redis://redis:6379
JWT_SECRET=replace_with_a_secure_secret
JWT_EXPIRES_IN=7d
AI_SERVICE_URL=http://ai-service:8000
```

Create `ai-service/.env`:

```env
OPENAI_API_KEY=mock_key_for_local_testing
OPENAI_MODEL=gpt-4o-mini
EMBEDDING_MODEL=text-embedding-3-small
CHROMA_DB_DIR=/app/chroma_data
USE_MOCK_AI=true
```

For real OpenAI API usage, replace `OPENAI_API_KEY` with a valid API key and set `USE_MOCK_AI=false`.

### 3. Start the full application

```bash
docker compose up -d --build
```

### 4. Initialize the database

```bash
docker compose run --rm server npm run init-db
```

### 5. Open the app

Frontend:

```text
http://localhost:3000
```

Backend health:

```text
http://localhost:5000/health
```

AI service health:

```text
http://localhost:8000/health
```

## Test Credentials

You can register a new user through the UI, or use API commands to create one.

Example test account used during local development:

```text
Email: test@example.com
Password: password123
```

## Useful Commands

Start all services:

```bash
docker compose up -d --build
```

Stop all services:

```bash
docker compose down
```

View backend logs:

```bash
docker compose logs server
```

View frontend logs:

```bash
docker compose logs client
```

View AI service logs:

```bash
docker compose logs ai-service
```

Run database schema setup:

```bash
docker compose run --rm server npm run init-db
```

Run WebSocket test script:

```bash
docker compose run --rm server npm run test-ws -- <documentId> <jwtToken>
```

## API Overview

### Auth

```text
POST /auth/register
POST /auth/login
GET  /auth/me
```

### Documents

```text
POST   /documents
GET    /documents
GET    /documents/:id
DELETE /documents/:id
```

### AI

```text
POST /ai/complete
```

### WebSocket

```text
ws://localhost:5000
```

Supported message types include:

```text
JOIN_DOCUMENT
OPERATION
CURSOR
DOCUMENT_JOINED
REMOTE_OPERATION
OPERATION_ACK
CURSOR_ACK
USER_JOINED
USER_LEFT
```

## Current Limitations

- The frontend prototype currently syncs insert operations more reliably than delete operations.
- AI completion is inserted at the end of the editor content in the current UI version.
- Mock AI mode is enabled by default for free local testing.
- Full multi-user conflict handling can be expanded further with more robust Operational Transformation or CRDT logic.

## Future Improvements

- Add full delete-operation support from the frontend editor
- Insert AI completion at the actual cursor position
- Add collaborator invite/share flow
- Add syntax language selector
- Add tests for REST routes and WebSocket flows
- Add production deployment configuration
- Add RAG-based codebase-aware AI assistance using ChromaDB

## Project Status

Completed core prototype:

- Full-stack Docker setup
- JWT auth
- Document CRUD
- WebSocket sync
- Redis operation history
- Cursor presence
- FastAPI AI completion service
- Backend AI proxy
- React dashboard
- CodeMirror editor