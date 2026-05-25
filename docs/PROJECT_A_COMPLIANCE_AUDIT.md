# Project A Compliance Audit

**Branch audited:** `phase3-project-a-gap-audit` (repository file inspection)  
**Audit date:** 2026-05-24  
**Method:** Static review of source, config, and docs. No claim is marked **Complete** unless implementation evidence exists in the repo.

**Summary:** The project is a strong, demo-ready **local** full-stack prototype. Most core engineering requirements are implemented. **AI/RAG stack fidelity was improved** on branch `phase3-real-openai-langchain-rag` (LangChain embeddings + chat, tiktoken chunking, `AI_MOCK_MODE`). Remaining gaps are concentrated in **collaborator workflows**, **live deployment proof**, and **portfolio media** (GIF, video, public URL).

---

## Compliance table

| Requirement from Project A | Status | Evidence from repo | Gap or next action |
|----------------------------|--------|-------------------|-------------------|
| Browser-based collaborative code editor | **Complete** | `client/src/App.jsx` — CodeMirror editor, document UI, real-time updates via WebSocket | None for core browser editor |
| Multiple users editing the same file simultaneously in real time | **Partial** | `server/src/websocketServer.js` — rooms, `REMOTE_OPERATION`, Redis history; `client/src/App.jsx` — queued insert/delete sync from CodeMirror ChangeSets | Insert, delete, and replace (as delete+insert) sync; not Google Docs–level conflict UX. Prove with two browser tabs + screen recording |
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
| LangChain RAG pipeline | **Complete** | `rag_store.py` — `langchain_openai.OpenAIEmbeddings`; `main.py` — `langchain_openai.ChatOpenAI` + ChromaDB store/query | Real mode uses LangChain for embeddings and chat; mock mode uses deterministic local embeddings |
| ChromaDB vector storage | **Complete** | `ai-service/rag_store.py` — `chromadb.PersistentClient`, `collection.add`, `collection.query` | Separate collections for mock vs OpenAI embedding dimensions |
| OpenAI `gpt-4o-mini` for completions / explanations | **Complete** | `main.py` — `ChatOpenAI(model=OPENAI_MODEL)` when `AI_MOCK_MODE=false`; default mock without key | Default local demo remains mock unless `OPENAI_API_KEY` is set and `AI_MOCK_MODE=false` |
| OpenAI `text-embedding-3-small` for embeddings | **Complete** | `rag_store.py` — `OpenAIEmbeddings(model=EMBEDDING_MODEL)` when `AI_MOCK_MODE=false` | Mock mode uses `mock_embedding()`; real mode uses OpenAI embeddings |
| `tiktoken` for token counting / chunking | **Complete** | `rag_store.py` — `tiktoken.get_encoding`, `count_tokens`, token-budget chunk packing in `split_code_into_chunks` | Used in both mock and real modes for chunk sizing |
| Code chunking function/class-aware | **Complete** | `rag_store.py` — language-specific regex boundaries (JS/TS, Python, Java, Go), tiktoken budgets, metadata `chunk_type`/`symbol_name`; `python rag_store.py` self-test | Regex best-effort, not full AST parsing; oversized symbols split as `block` parts |
| Docker + Docker Compose for all services | **Complete** | `docker-compose.yml` — postgres, redis, server, ai-service, client | Local dev uses bind mounts + dev commands |
| Nginx reverse proxy for deployment | **Partial** | `deploy/nginx/default.conf`, `deploy/nginx/Dockerfile`, `docker-compose.prod.yml` nginx service | Config exists; **not the same as a proven public deployment** |
| GitHub Actions CI | **Complete** | `.github/workflows/ci.yml` — frontend build, backend `npm run check`, AI `py_compile` | No E2E or Docker CI job |
| Deployment on Railway or AWS EC2 | **Missing** | No `railway.json`, Terraform, EC2 user-data, or host-specific docs beyond generic `DEPLOYMENT.md` | Only deployment-**ready** Compose/nginx; no Railway/EC2 runbook or proof |
| README with architecture diagram | **Partial** | `README.md` — ASCII/text diagrams in markdown | Spec asks for diagram in README; **no committed image diagram** (`docs/assets/` absent; `docs/SCREENSHOTS.md` is a checklist only) |
| Screenshots / demo GIF in repo | **Missing** | `docs/SCREENSHOTS.md` lists desired assets; **0 image/gif/video files** in repository (glob `*.{png,gif,mp4}` → none) | Capture and commit assets or link externally |
| 3-minute demo video | **Needs Manual Proof** | `docs/DEMO_SCRIPT.md` provides script only | No video file or hosted link in repo |
| Working demo URL (public) | **Missing** | README states no public deployment unless user hosts; no production URL in docs | Deploy to Railway/EC2/etc. and add real URL to README |
| Two browser tabs, same document, conflict handling | **Partial** | Server OT in `server/src/otEngine.js` (ot.js); client `collabOperations.js` + queued WebSocket ops | Demo-able manually (insert, delete, replace-over-selection); **no automated E2E proof** in repo |
| Document snapshots every 50 operations | **Complete** | `server/src/websocketServer.js` — `SNAPSHOT_INTERVAL = 50`; `maybeCreateSnapshot` on operation ack path | None |
| Version history + restore workflow | **Complete** | `GET /documents/:id/history`, `POST .../restore/:snapshotId`; UI: Load History, Restore in `App.jsx` | None |
| AI Complete | **Complete** | `POST /ai/complete` proxy; `handleAiComplete` in `App.jsx` | Mock mode default |
| Explain Selection | **Complete** | `POST /ai/explain`; `handleExplainSelection` | Mock mode default |
| Codebase Chat | **Complete** | `POST /ai/chat`; `handleChatSubmit` | Mock mode default |
| RAG references in UI | **Complete** | `formatRagReferences` in `App.jsx`; `rag_chunks` from API; Index for RAG button | Retrieval uses mock embeddings unless extended |
| Colored remote cursors inside editor | **Complete** | `client/src/remoteCursorExtension.js` — ViewPlugin decorations (caret widget + selection highlight); `App.jsx` filters local user; footer presence panel retained | Manual two-tab check recommended when Docker/browser testing is available |
| Replace operations supported in collaborative sync | **Complete** | `client/src/collabOperations.js` — replace → delete+insert; `App.jsx` operation queue per `OPERATION_ACK` | Backend still uses insert/delete only; simultaneous heavy edits need manual two-tab validation |
| Redis pub/sub echo-loop prevention | **Complete** | `pubsub.js` — `serverInstanceId`, skip if `event.serverInstanceId === serverInstanceId` | None |
| Final Docker Compose run proven after latest changes | **Needs Manual Proof** | Docs describe `docker compose up`; no CI log or committed test report post–Tailwind/nginx | Re-run full stack and record results in README or CI |
| `DEPLOYMENT.md` / env templates without secrets | **Complete** | `DEPLOYMENT.md`, `deploy/env.prod.example`, `server/.env.example`, `ai-service/.env.example` | None |

---

## Strict deep-dive notes

### AI / RAG stack vs specification wording

| Spec item | What the repo actually does |
|-----------|----------------------------|
| LangChain | **Wired in real mode** — `OpenAIEmbeddings` + `ChatOpenAI` in `ai-service/`. |
| ChromaDB | **Actually used** for persist, index, and query (mock and OpenAI collections). |
| `text-embedding-3-small` | **Wired when `AI_MOCK_MODE=false`** via `OpenAIEmbeddings`. |
| `tiktoken` | **Wired** — token-budget chunking in `split_code_into_chunks`. |
| `gpt-4o-mini` | **Wired when `AI_MOCK_MODE=false`** via `ChatOpenAI`. |

### Collaboration / OT

| Area | Assessment |
|------|------------|
| Server OT | **Implemented** — `ot` package, transform against Redis history (`otEngine.js`, `websocketServer.js`). |
| Client OT | **Improved** — CodeMirror 6 `ChangeSet` → insert/delete (+ replace as delete+insert queue); no client-side ot.js transform. |
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

1. **Collaborator invite flow** — API + UI to insert `document_collaborators` (currently schema-only).
4. **Optional:** PostgreSQL `sessions` table if spec requires server-side sessions beyond JWT.

### Testing / validation tasks

1. **Two-browser manual test** — same document, simultaneous typing, capture evidence (GIF).
2. **WebSocket script** — `npm run test-ws` in Compose after clean build.
3. **Multi-instance Redis pub/sub** — two `server` replicas behind nginx/Redis (prove cross-instance fan-out).
4. **Real OpenAI path** — one run with `AI_MOCK_MODE=false` and valid key (completion + RAG); document results in README.
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
| Editor collaboration | 0 | — |
| Collaborators + sessions | 1 | If required by grader |
| Testing / validation | 2 | Compose proof + two-browser GIF evidence |
| Deployment | 2–3 | Railway or EC2 + live URL + smoke tests |
| Documentation / media | 2 | Diagram + README embeds + video checklist |
| **Total** | **~8–12 focused prompts** | AI/RAG stack items addressed; remaining work is editor UX, deployment proof, and media |

---

## Recruiter-safe one-line summary

**“Full-stack real-time collab editor with JWT, Redis OT history, WebSocket sync, snapshots, FastAPI + LangChain/ChromaDB RAG (mock or real OpenAI modes), Docker/CI/nginx config — strong local prototype; remaining work is in-editor presence polish, public deployment, and demo media.”**

---

## Audit integrity statement

This document reflects **repository contents only**. Items marked **Needs Manual Proof** require human-run validation (Docker daemon, browser demo, hosting platform). Items marked **Missing** are not implemented in code paths reviewed. Do not claim 100% Project A compliance until the table rows and media/deployment gaps are closed.
