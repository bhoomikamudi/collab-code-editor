# Project A Compliance Audit

**Branch audited:** `phase3-project-a-gap-audit` (repository file inspection)  
**Audit date:** 2026-05-24  
**Method:** Static review of source, config, and docs. No claim is marked **Complete** unless implementation evidence exists in the repo.

**Summary:** The project is a strong, demo-ready **local** full-stack prototype. Most core engineering requirements are implemented. Gaps are concentrated in **spec-mandated AI stack fidelity** (LangChain, tiktoken, real embeddings), **editor UX depth** (colored remote cursors, replace sync), **collaborator workflows**, **live deployment proof**, and **portfolio media** (GIF, video, public URL).

---

## Compliance table

| Requirement from Project A | Status | Evidence from repo | Gap or next action |
|----------------------------|--------|-------------------|-------------------|
| Browser-based collaborative code editor | **Complete** | `client/src/App.jsx` — CodeMirror editor, document UI, real-time updates via WebSocket | None for core browser editor |
| Multiple users editing the same file simultaneously in real time | **Partial** | `server/src/websocketServer.js` — rooms, `REMOTE_OPERATION`, Redis history; `client/src/App.jsx` — `new WebSocket`, applies remote ops | Works for insert/delete in demos; replace edits blocked client-side (`operation.type === "replace"` → not synced). Not Google Docs–level conflict UX. Prove with two browser tabs + screen recording |
| React frontend | **Complete** | `client/package.json` — `react`, `react-dom`; `client/src/App.jsx` | None |
| CodeMirror 6 editor | **Complete** | `client/package.json` — `@codemirror/state`, `@codemirror/view`, `@codemirror/lang-javascript`, `codemirror@^6`; `@uiw/react-codemirror` | None |
| Native WebSocket client (not Socket.IO client) | **Complete** | `client/src/App.jsx` — `const socket = new WebSocket(WS_URL)`; no `socket.io-client` in `client/package.json` | None |
| Tailwind CSS | **Complete** | `client/tailwind.config.js`, `client/postcss.config.js`, `client/src/index.css` (`@tailwind` directives), Tailwind classes in `App.jsx` | None |
| Axios for REST calls | **Complete** | `client/src/api.js` — `axios.create`, JWT interceptor; all API helpers use `apiClient` | None (README no longer claims Fetch for API) |
| Node.js / Express REST API | **Complete** | `server/src/index.js` — Express, `/auth`, `/documents`, `/ai`, `/health` | None |
| `ws` WebSocket server | **Complete** | `server/package.json` — `ws`; `server/src/websocketServer.js` — `WebSocket.Server({ server })` | None |
| Redis pub/sub between server instances | **Complete** | `server/src/pubsub.js` — channel `collab:websocket:events`, publisher + subscriber; `server/src/websocketServer.js` — `initPubSub`, `publishRoomEvent` | Multi-instance load test not documented in repo |
| Redis for operational transform history | **Complete** | `server/src/operationStore.js` — `doc:{id}:ops` Redis list, `appendOperation`, `getOperationsSince` | None |
| PostgreSQL for users | **Complete** | `server/src/schema.sql` — `users` table; `server/src/authRoutes.js` — register/login | None |
| PostgreSQL for documents | **Complete** | `schema.sql` — `documents`; `server/src/documentRoutes.js` — CRUD | None |
| PostgreSQL for sessions / user session data | **Partial** | JWT stored in `localStorage` (`client/src/api.js` — `authToken`); `GET /auth/me` | No dedicated `sessions` table or server-side session store. Spec may mean “user auth state” — met via JWT, not DB sessions |
| PostgreSQL for collaborators | **Partial** | `schema.sql` — `document_collaborators`; access checks JOIN collaborators in `documentRoutes.js`, `websocketServer.js` | **No API or UI to add collaborators** — only schema + query support; owners cannot invite others from the app |
| PostgreSQL for snapshots | **Complete** | `schema.sql` — `document_snapshots`; `server/src/snapshotStore.js`; restore in `documentRoutes.js` | None |
| JWT authentication | **Complete** | `server/src/auth.js`, `authRoutes.js`; Bearer token on API; `JOIN_DOCUMENT` requires JWT in `websocketServer.js` | None |
| Python FastAPI AI microservice | **Complete** | `ai-service/main.py` — FastAPI app, `/health`, `/index`, `/complete`, `/explain`, `/chat` | None |
| LangChain RAG pipeline | **Missing** | `ai-service/requirements.txt` lists `langchain`, `langchain-openai`, `langchain-community` | **No `import langchain` or LangChain APIs in `main.py` or `rag_store.py`**. RAG is custom ChromaDB + OpenAI SDK, not a LangChain pipeline |
| ChromaDB vector storage | **Complete** | `ai-service/rag_store.py` — `chromadb.PersistentClient`, `collection.add`, `collection.query` | Used with **mock embeddings** by default (see below) |
| OpenAI `gpt-4o-mini` for completions / explanations | **Partial** | `ai-service/main.py` — `OPENAI_MODEL` default `gpt-4o-mini`, `client.chat.completions.create` when `USE_MOCK_AI` is false | Default local path: `ai-service/.env.example` has `USE_MOCK_AI=true`. Real GPT path exists but is not the default demo configuration |
| OpenAI `text-embedding-3-small` for embeddings | **Missing** | `EMBEDDING_MODEL` in `.env.example` only | `rag_store.py` uses `mock_embedding()` — **never calls OpenAI embeddings API** or reads `EMBEDDING_MODEL` |
| `tiktoken` for token counting / chunking | **Missing** | `tiktoken==0.7.0` in `requirements.txt` only | **Not imported or used** in `rag_store.py` or `main.py`. Chunking is line/boundary heuristics, not token-based |
| Code chunking function/class-aware | **Partial** | `rag_store.py` — `split_code_into_chunks()` regex for `def`, `class`, `function`, etc., then line windows | Heuristic split, not AST-aware; adequate for prototype, not full structural parsing |
| Docker + Docker Compose for all services | **Complete** | `docker-compose.yml` — postgres, redis, server, ai-service, client | Local dev uses bind mounts + dev commands |
| Nginx reverse proxy for deployment | **Partial** | `deploy/nginx/default.conf`, `deploy/nginx/Dockerfile`, `docker-compose.prod.yml` nginx service | Config exists; **not the same as a proven public deployment** |
| GitHub Actions CI | **Complete** | `.github/workflows/ci.yml` — frontend build, backend `npm run check`, AI `py_compile` | No E2E or Docker CI job |
| Deployment on Railway or AWS EC2 | **Missing** | No `railway.json`, Terraform, EC2 user-data, or host-specific docs beyond generic `DEPLOYMENT.md` | Only deployment-**ready** Compose/nginx; no Railway/EC2 runbook or proof |
| README with architecture diagram | **Partial** | `README.md` — ASCII/text diagrams in markdown | Spec asks for diagram in README; **no committed image diagram** (`docs/assets/` absent; `docs/SCREENSHOTS.md` is a checklist only) |
| Screenshots / demo GIF in repo | **Missing** | `docs/SCREENSHOTS.md` lists desired assets; **0 image/gif/video files** in repository (glob `*.{png,gif,mp4}` → none) | Capture and commit assets or link externally |
| 3-minute demo video | **Needs Manual Proof** | `docs/DEMO_SCRIPT.md` provides script only | No video file or hosted link in repo |
| Working demo URL (public) | **Missing** | README states no public deployment unless user hosts; no production URL in docs | Deploy to Railway/EC2/etc. and add real URL to README |
| Two browser tabs, same document, conflict handling | **Partial** | Server OT in `server/src/otEngine.js` (ot.js); client `getSimpleOperation` + insert/delete sync | Demo-able manually; replace not synced; **no automated E2E proof** in repo |
| Document snapshots every 50 operations | **Complete** | `server/src/websocketServer.js` — `SNAPSHOT_INTERVAL = 50`; `maybeCreateSnapshot` on operation ack path | None |
| Version history + restore workflow | **Complete** | `GET /documents/:id/history`, `POST .../restore/:snapshotId`; UI: Load History, Restore in `App.jsx` | None |
| AI Complete | **Complete** | `POST /ai/complete` proxy; `handleAiComplete` in `App.jsx` | Mock mode default |
| Explain Selection | **Complete** | `POST /ai/explain`; `handleExplainSelection` | Mock mode default |
| Codebase Chat | **Complete** | `POST /ai/chat`; `handleChatSubmit` | Mock mode default |
| RAG references in UI | **Complete** | `formatRagReferences` in `App.jsx`; `rag_chunks` from API; Index for RAG button | Retrieval uses mock embeddings unless extended |
| Colored remote cursors inside editor | **Missing** | Presence stored with cursor positions (`presenceStore.js`); UI shows **email list only** in footer (`Presence: user1, user2`) | No CodeMirror remote cursor decorations / peer caret colors |
| Replace operations supported in collaborative sync | **Missing** | Client explicitly rejects replace: `App.jsx` lines ~463–465 | Typing that produces replace diff does not sync |
| Redis pub/sub echo-loop prevention | **Complete** | `pubsub.js` — `serverInstanceId`, skip if `event.serverInstanceId === serverInstanceId` | None |
| Final Docker Compose run proven after latest changes | **Needs Manual Proof** | Docs describe `docker compose up`; no CI log or committed test report post–Tailwind/nginx | Re-run full stack and record results in README or CI |
| `DEPLOYMENT.md` / env templates without secrets | **Complete** | `DEPLOYMENT.md`, `deploy/env.prod.example`, `server/.env.example`, `ai-service/.env.example` | None |

---

## Strict deep-dive notes

### AI / RAG stack vs specification wording

| Spec item | What the repo actually does |
|-----------|----------------------------|
| LangChain | Dependency pin only. Pipeline = FastAPI → `rag_store.py` (Chroma + mock embed) → OpenAI Chat Completions API. |
| ChromaDB | **Actually used** for persist, index, and query. |
| `text-embedding-3-small` | **Not wired.** Embeddings are deterministic `mock_embedding()` hashes. |
| `tiktoken` | **Not wired.** Chunk size is line-based (`max_lines_per_chunk=80`), not token budget. |
| `gpt-4o-mini` | Implemented behind `USE_MOCK_AI=false` + valid `OPENAI_API_KEY`. |

### Collaboration / OT

| Area | Assessment |
|------|------------|
| Server OT | **Implemented** — `ot` package, transform against Redis history (`otEngine.js`, `websocketServer.js`). |
| Client OT | **Simplified** — diff → insert/delete only; no client-side ot.js. |
| Replace | **Not supported** for sync. |
| Remote cursors | **Data exists**, **visualization missing** in editor. |
| Conflict handling | **Prototype-level** — suitable for portfolio demo with caveats, not spec-grade concurrent editing. |

### Deployment

| Area | Assessment |
|------|------------|
| Local Compose | `docker-compose.yml` intact with hot reload. |
| Prod-style | `docker-compose.prod.yml` + nginx — **configuration complete**, **hosted deployment not evidenced**. |
| Railway / EC2 | **Not documented or configured** in repo. |

### Documentation / media

| Deliverable | In repo? |
|-------------|----------|
| Text architecture diagram | Yes (`README.md`) |
| Image architecture diagram | No |
| Demo GIF | No (checklist only) |
| Demo video | No |
| Live URL | No |

---

## Remaining Tasks to Reach Exact 100% Project A Compliance

### Code tasks

1. **Wire real RAG stack to spec (choose honest path):**
   - Either implement LangChain + OpenAI embeddings (`text-embedding-3-small`) + tiktoken-aware chunking in `rag_store.py` / `main.py`, **or** document a spec deviation if course allows custom pipeline only.
2. **Use `EMBEDDING_MODEL` and OpenAI embeddings API** when `USE_MOCK_AI=false` (keep mock path for free local dev).
3. **Import and use `tiktoken`** for chunk token limits (or LangChain text splitters that use it).
4. **Support replace operations** in client diff → server sync path (or document as out-of-scope with spec approval).
5. **Render colored remote cursors / selections** in CodeMirror from `presence` (extensions or decorations).
6. **Collaborator invite flow** — API + UI to insert `document_collaborators` (currently schema-only).
7. **Optional:** PostgreSQL `sessions` table if spec requires server-side sessions beyond JWT.

### Testing / validation tasks

1. **Two-browser manual test** — same document, simultaneous typing, capture evidence (GIF).
2. **WebSocket script** — `npm run test-ws` in Compose after clean build.
3. **Multi-instance Redis pub/sub** — two `server` replicas behind nginx/Redis (prove cross-instance fan-out).
4. **Real OpenAI path** — one run with `USE_MOCK_AI=false` and valid key (completion + RAG).
5. **Full regression** — `docker compose up --build` and `docker compose -f docker-compose.prod.yml up --build` after changes; document pass/fail.

### Deployment tasks

1. **Deploy to Railway *or* AWS EC2** per spec (pick one; add minimal runbook).
2. **Publish working demo URL** — HTTPS, nginx or platform URL in README.
3. **Set production env vars** — `JWT_SECRET`, DB, Redis, `CLIENT_URL`, optional OpenAI key (secrets in platform, not git).
4. **Verify routes through proxy** — `/`, `/auth`, `/documents`, `/ai`, `/health`, `/ws`, `/ai-service/health`.

### Documentation / media tasks

1. **Add image architecture diagram** to README (`docs/assets/architecture.png`).
2. **Capture demo GIF** — two-tab sync (see `docs/SCREENSHOTS.md`).
3. **Record 3-minute demo video** — follow `docs/DEMO_SCRIPT.md`; host (YouTube unlisted / Loom).
4. **Embed GIF + video + live URL** in README (no fake URLs).
5. **Update this audit** after each milestone until all rows are Complete or explicitly waived.

---

## Estimated additional Cursor prompts / tasks

| Category | Suggested prompts | Notes |
|----------|-------------------|--------|
| AI / RAG fidelity | 2–3 | LangChain + embeddings + tiktoken is one large or two medium tasks |
| Editor collaboration | 2 | Remote cursors + replace sync |
| Collaborators + sessions | 1 | If required by grader |
| Testing / validation | 2 | Compose proof + two-browser GIF evidence |
| Deployment | 2–3 | Railway or EC2 + live URL + smoke tests |
| Documentation / media | 2 | Diagram + README embeds + video checklist |
| **Total** | **~10–14 focused prompts** | Assumes no major refactors beyond listed gaps; fewer if spec allows waiving LangChain label while keeping ChromaDB |

---

## Recruiter-safe one-line summary

**“Full-stack real-time collab editor with JWT, Redis OT history, WebSocket sync, snapshots, FastAPI + ChromaDB RAG UI, Docker/CI/nginx config — strong local prototype; remaining work is spec-faithful AI stack wiring, in-editor presence polish, public deployment, and demo media.”**

---

## Audit integrity statement

This document reflects **repository contents only**. Items marked **Needs Manual Proof** require human-run validation (Docker daemon, browser demo, hosting platform). Items marked **Missing** are not implemented in code paths reviewed. Do not claim 100% Project A compliance until the table rows and media/deployment gaps are closed.
