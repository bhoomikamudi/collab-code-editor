# Project A Compliance Audit

**Branch audited:** `phase3-project-a-gap-audit` (repository file inspection)  
**Audit date:** 2026-05-24  
**Method:** Static review of source, config, and docs. No claim is marked **Complete** unless implementation evidence exists in the repo.

**Summary:** The project is a strong, demo-ready **local** full-stack prototype. Most core engineering requirements are implemented. **AI/RAG stack fidelity was improved** on branch `phase3-real-openai-langchain-rag` (LangChain embeddings + chat, tiktoken chunking, `AI_MOCK_MODE`). Remaining gaps are concentrated in **live deployment proof** and **portfolio media** (GIF, video, public URL).

> **Upgraded spec:** For the stricter **Project 3 — Production Real-Time Distributed System** requirements (TypeScript, Next.js, C++ N-API OT, gRPC, Redis Cluster, K8s, observability, Cypress, etc.), see **[UPGRADED_PROJECT3_COMPLIANCE_AUDIT.md](./UPGRADED_PROJECT3_COMPLIANCE_AUDIT.md)**. That audit is independent; Project A status in this file is unchanged.

---

## Compliance table

| Requirement from Project A | Status | Evidence from repo | Gap or next action |
|----------------------------|--------|-------------------|-------------------|
| Browser-based collaborative code editor | **Complete** | `client/src/App.jsx` — CodeMirror editor, document UI, real-time updates via WebSocket | None for core browser editor |
| Multiple users editing the same file simultaneously in real time | **Partial** | `server/src/websocketServer.js` — rooms, `REMOTE_OPERATION`, Redis history; `client/src/App.jsx` — queued insert/delete sync; **manual browser validation (2026-05-25)** — User A insert/delete persisted; User B write session opened shared doc; cross-user `REMOTE_OPERATION` observed; revision UI reached 5 | Simultaneous two-tab editing not proven in one browser profile; replace-over-selection not fully exercised in browser automation |
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
| PostgreSQL for collaborators | **Complete** | `document_collaborators` + `documentAccess.js`; REST share routes; WebSocket `can_write` enforcement; Share panel in `App.jsx`; **manual validation** — write collaborator edits; read-only join blocks editor input; non-owner HTTP 403 on delete | None for core collaborator flows |
| PostgreSQL for snapshots | **Complete** | `schema.sql` — `document_snapshots`; `server/src/snapshotStore.js`; restore in `documentRoutes.js` | None |
| JWT authentication | **Complete** | `server/src/auth.js`, `authRoutes.js`; Bearer token on API; `JOIN_DOCUMENT` requires JWT in `websocketServer.js` | None |
| Python FastAPI AI microservice | **Complete** | `ai-service/main.py` — FastAPI app, `/health`, `/index`, `/complete`, `/explain`, `/chat` | None |
| LangChain RAG pipeline | **Implemented, Needs Manual Proof** | `rag_store.py` — `langchain_openai.OpenAIEmbeddings`; `main.py` — `langchain_openai.ChatOpenAI` + ChromaDB store/query; mock mode validated in Docker E2E | Real LangChain + OpenAI API path **not live-validated** (no `OPENAI_API_KEY` in shell or local `ai-service/.env` during this run) |
| ChromaDB vector storage | **Complete (mock)** / **Needs Manual Proof (real embeddings)** | `rag_store.py` — `chromadb.PersistentClient`, `collection.add`, `collection.query`; mock collection validated in Docker E2E | OpenAI embedding collection (`codebase_chunks_openai`) not indexed/queried with a real key in this run |
| OpenAI `gpt-4o-mini` for completions / explanations | **Implemented, Needs Manual Proof** | `main.py` — `ChatOpenAI(model=OPENAI_MODEL)` when `AI_MOCK_MODE=false`; default `gpt-4o-mini` in `config.py` | No live `/complete`, `/explain`, or `/chat` calls with a real key |
| OpenAI `text-embedding-3-small` for embeddings | **Implemented, Needs Manual Proof** | `rag_store.py` — `OpenAIEmbeddings(model=EMBEDDING_MODEL)` when `AI_MOCK_MODE=false`; default `text-embedding-3-small` | No live embedding/index/query run with a real key |
| `tiktoken` for token counting / chunking | **Complete** | `rag_store.py` — `tiktoken.get_encoding`, `count_tokens`, token-budget chunk packing; **`python rag_store.py` self-test passed (2026-05-25)** | Chunk sizing verified locally; independent of OpenAI API |
| Code chunking function/class-aware | **Complete** | `rag_store.py` — language-specific regex boundaries (JS/TS, Python, Java, Go), tiktoken budgets, metadata `chunk_type`/`symbol_name`; `python rag_store.py` self-test | Regex best-effort, not full AST parsing; oversized symbols split as `block` parts |
| Docker + Docker Compose for all services | **Complete** | `docker-compose.yml` — postgres, redis, server, ai-service, client | Local dev uses bind mounts + dev commands |
| Nginx reverse proxy for deployment | **Partial** | `deploy/nginx/default.conf`, `deploy/nginx/Dockerfile`, `docker-compose.prod.yml` nginx service | Config exists; **not the same as a proven public deployment** |
| GitHub Actions CI | **Complete** | `.github/workflows/ci.yml` — frontend build, backend `npm run check`, AI `py_compile` | No E2E or Docker CI job |
| Deployment on Railway or AWS EC2 | **Missing** | No `railway.json`, Terraform, EC2 user-data, or host-specific docs beyond generic `DEPLOYMENT.md` | Only deployment-**ready** Compose/nginx; no Railway/EC2 runbook or proof |
| README with architecture diagram | **Complete** | `README.md` — embedded `docs/assets/architecture.svg` + ASCII/text diagrams | SVG complements existing text diagram; no live deployment URL in asset |
| Screenshots / demo GIF in repo | **Prepared** | `docs/assets/screenshots/` + [SCREENSHOTS.md](SCREENSHOTS.md) capture checklist; README **Demo Screenshots** placeholder; **0 PNG/GIF files committed yet** | Capture real assets from local Docker demo; commit files and uncomment README embeds |
| 3-minute demo video | **Needs Manual Proof** | `docs/DEMO_SCRIPT.md` provides script only | No video file or hosted link in repo |
| Working demo URL (public) | **Missing** | README states no public deployment unless user hosts; no production URL in docs | Deploy to Railway/EC2/etc. and add real URL to README |
| Two browser tabs, same document, conflict handling | **Partial** | Server OT in `server/src/otEngine.js` (ot.js); client `collabOperations.js` + queued WebSocket ops; **manual validation** — insert, backspace delete, **full-document replace** sync to PostgreSQL; revision counter increments | Simultaneous two-tab typing not proven; partial-line replace not exercised in browser automation (CodeMirror selection not set by MCP keyboard) |
| Document snapshots every 50 operations | **Complete** | `server/src/websocketServer.js` — `SNAPSHOT_INTERVAL = 50`; `maybeCreateSnapshot` on operation ack path | None |
| Version history + restore workflow | **Complete** | `GET /documents/:id/history`, `POST .../restore/:snapshotId`; UI: Load History, Restore in `App.jsx` | None |
| AI Complete | **Complete (mock)** | `POST /ai/complete` proxy; `handleAiComplete` in `App.jsx`; mock validated in Docker E2E | Real OpenAI completions not live-validated |
| Explain Selection | **Complete (mock)** | `POST /ai/explain`; `handleExplainSelection`; mock validated in Docker E2E | Real OpenAI explanations not live-validated |
| Codebase Chat | **Complete (mock)** | `POST /ai/chat`; `handleChatSubmit`; mock validated in Docker E2E | Real OpenAI chat not live-validated |
| RAG references in UI | **Complete** | `formatRagReferences` in `App.jsx`; `rag_chunks` from API; Index for RAG button | Retrieval uses mock embeddings unless extended |
| Colored remote cursors inside editor | **Partial** | `client/src/remoteCursorExtension.js` — ViewPlugin decorations; `CURSOR` / `CURSOR_UPDATE` in `websocketServer.js`; **manual validation** — User B WebSocket client sent `CURSOR` with selection range while User A had doc open | Colored caret/selection highlight **not visually confirmed** in browser screenshot during this run (B session disconnected quickly; presence footer showed local user only) |
| Replace operations supported in collaborative sync | **Complete** | `client/src/collabOperations.js` — replace → delete+insert with sequential position offsets; `App.jsx` — uncontrolled CodeMirror + `ExternalChange` external sync (fixes controlled `value` latch revert); **browser verified (2026-05-25)** — full-document replace persists correctly | Keyboard Ctrl+A in browser automation tools may not set CodeMirror selection; human editing verified via replace transaction |
| Redis pub/sub echo-loop prevention | **Complete** | `pubsub.js` — `serverInstanceId`, skip if `event.serverInstanceId === serverInstanceId` | None |
| Final Docker Compose run proven after latest changes | **Partial (2026-05-25)** | Compose + API/WebSocket + **manual browser workflows** validated on `phase3-manual-browser-validation`; WebSocket persistence bug fixed in `App.jsx` | Simultaneous dual-browser GIF/recording and remote-cursor visuals still pending — see [Manual browser validation](#manual-browser-validation) |
| `DEPLOYMENT.md` / env templates without secrets | **Complete** | `DEPLOYMENT.md`, `deploy/env.prod.example`, `server/.env.example`, `ai-service/.env.example` | None |

---

## Full Docker E2E validation

**Branch:** `phase3-full-docker-e2e-validation`  
**Date:** 2026-05-25 (second run with Docker Desktop running)  
**Overall status:** **Partial pass** — stack, REST, WebSocket, and mock AI validated; interactive two-tab UX not fully automated

### Fixes applied during validation

| Issue | Fix |
|-------|-----|
| `collab_client` exited: `Cannot find module 'tailwindcss'` | Moved Tailwind/PostCSS/Vite to `dependencies`; removed stale `/app/node_modules` anonymous volume; `command: npm install && npm run dev` in `docker-compose.yml` |

### Infrastructure

| Step | Result |
|------|--------|
| `docker compose up -d --build` | **Pass** (after client fix) |
| `docker ps` | **Pass** — postgres, redis, server, ai-service, client running |
| `GET /health` server `:5000` | **Pass** — `status: ok` |
| `GET /health` ai-service `:8000` | **Pass** — `ai_mode: mock` |
| `docker compose exec server npm run init-db` | **Pass** |
| `docker compose down` | **Pass** |

### API / WebSocket (PowerShell + `testWebSocket.js`)

| # | Area | Result | Notes |
|---|------|--------|-------|
| 5 | Auth — register User A & B, `/auth/me` | **Pass** | |
| 6 | Documents — create, list, metadata | **Pass** | `access_role`, `permission_level` on shared doc |
| 7a | Share write → B lists/opens doc | **Pass** | |
| 7b | B sends `OPERATION` via WebSocket | **Pass** | `OPERATION_ACK`, revision increments |
| 7c | Re-share B as **read** → B `OPERATION` blocked | **Pass** | `ERROR: read-only access`; `can_write: false` on join |
| 7d | B cannot delete document | **Pass** | HTTP 403 |
| 8 | Two-tab insert/delete/replace in browser | **Not automated** | Needs manual two-tab demo |
| 9 | Remote cursors (two users) | **Not automated** | Needs second browser/user session |
| 10 | AI/RAG mock (REST) | **Pass** | index, complete, explain, chat; `rag_chunks` returned |
| 11 | Version history | **Pass (empty)** | `GET /history` → `[]`; UI copy explains 50-op snapshots |
| 12 | Logs | **Pass with warnings** | Server: no crashes; AI: Chroma telemetry warnings only (non-fatal) |

### Frontend smoke (`http://localhost:3000`)

| Check | Result |
|-------|--------|
| Login User A | **Pass** |
| Document list shows shared doc + Owner label | **Pass** |
| Open document → editor + Connected / joined room | **Pass** |
| Share panel + collaborator row | **Pass** |
| Index for RAG triggered | **Pass** (in progress → joined room) |

Not exercised in browser automation this run: AI Complete, Explain, Chat buttons after index; Load History restore; User B session; simultaneous typing/replace; remote caret colors.

### Post-teardown static checks — pass

`npm run check` (server), `npm run build` (client), `python -m py_compile` (ai-service).

### Still needs manual proof

- Two browser tabs or two accounts: insert, delete, replace-over-selection, revision sync.
- Colored remote cursor/selection with two distinct users.
- Snapshot restore after 50+ operations.
- Real OpenAI path (`AI_MOCK_MODE=false` + valid key) — **not** tested.

### Re-run procedure

```bash
docker compose up -d --build
docker compose exec server npm run init-db   # first time only
# API: register/login, share, test-ws
# Browser: http://localhost:3000 — docs/DEMO_SCRIPT.md
docker compose down
```

---

## Manual browser validation

**Branch:** `phase3-manual-browser-validation`  
**Date:** 2026-05-25  
**Overall status:** **Partial pass** — two-user browser workflows exercised sequentially; one WebSocket bug fixed; remote-cursor visuals and simultaneous editing not fully proven

### Bug fixed during validation

| Issue | Root cause | Fix |
|-------|------------|-----|
| Browser edits stuck on “Joined real-time document room”; operations not persisting | WebSocket `useEffect` depended on `[selectedDocument]`; `DOCUMENT_JOINED` metadata update re-ran the effect and **closed/reopened** the socket, breaking the operation queue | `client/src/App.jsx` — WebSocket effect deps → `[selectedDocument?.id]`; collaborator loader → `[selectedDocument?.id, selectedDocument?.access_role]` |
| Replace-over-selection appended text instead of replacing | `@uiw/react-codemirror` controlled `value` prop + 200ms typing latch could re-apply stale document text after CodeMirror had already applied a replace transaction | `App.jsx` — remove live `value` binding; sync external content via `EditorView.dispatch` + `ExternalChange`; derive OT ops from `onChange(value, viewUpdate)`; `collabOperations.js` — sequential position offsets for multi-region ChangeSets |

### Infrastructure (same as prior E2E run)

| Step | Result |
|------|--------|
| `docker compose up -d --build` | **Pass** |
| `docker compose exec server npm run init-db` | **Pass** |
| `GET http://localhost:5000/health` | **Pass** |
| `GET http://localhost:8000/health` | **Pass** — `ai_mode: mock` |
| `http://localhost:3000` | **Pass** |
| `docker compose down` (post-validation) | **Pass** |

### Two-user browser workflows (sequential sessions)

Test users: `manual-a-1779747584@test.com`, `manual-b-1779747584@test.com` (registered via API). Document: shared write → re-shared read for permission test.

| # | Workflow | Result | Notes |
|---|----------|--------|-------|
| 1 | User A register/login | **Pass** | |
| 2 | User A create/open document | **Pass** | |
| 3 | User A share with User B (write) | **Pass** | Share panel + Remove button; API collaborator row |
| 4 | User B login, list shared doc | **Pass** | Label: “Collaborator (write)” |
| 5 | User B open shared document | **Pass** | “Shared with you — Collaborator (write)” |
| 6 | User A insert typing → PostgreSQL | **Pass** (after WS fix) | e.g. appended `function test() {}` |
| 7 | User B insert typing | **Partial** | Text appeared in B editor; persistence laggy vs REST snapshot during session |
| 8 | Cross-user remote operation | **Pass** | B WebSocket `OPERATION` insert appeared in A browser (`REMOTE_OPERATION`) |
| 9 | User A backspace delete | **Pass** | Removed appended function from editor content |
| 10 | Replace-over-selection (Ctrl+A + type) | **Fixed (2026-05-25)** | Full-document replace verified in browser (`// replaced via fill test` persisted to PostgreSQL); ChangeSet unit test for delete+insert at same position; MCP Ctrl+A keyboard does not set CM selection |
| 11 | Revision increments | **Pass** | Editor header showed “Revision 5” |
| 12 | Read-only collaborator | **Pass** | API re-share as `read`; B UI: “Collaborator (read) · read-only editor”, “Joined document (read-only)”; CodeMirror input blocked |
| 13 | Write collaborator can edit | **Pass** | B typed while permission was `write` |
| 14 | Non-owner cannot delete | **Pass** | No Delete button in B UI; `DELETE /documents/:id` → HTTP 403 |

### Remote cursor / selection

| Check | Result | Notes |
|-------|--------|-------|
| User B sends `CURSOR` via WebSocket while A has doc open | **Pass (API/runtime)** | `docker compose exec server node -e …` sent selection range |
| User A sees colored remote caret + label | **Not verified** | Screenshot showed local presence only; B session disconnected quickly |
| User A selection visible to User B | **Not verified** | Not tested with two live browser sessions |

### AI / RAG (mock mode)

| Check | Result | Notes |
|-------|--------|-------|
| Index for RAG | **Pass** | |
| AI Complete | **Pass** | Mock completion + RAG ref |
| Explain Selection | **Pass** | Explanation + RAG ref |
| Codebase Chat | **Pass** | Answer states **mock RAG mode**; RAG ref shown |
| Real OpenAI path | **Not tested** | `ai_mode: mock` on `/health` |

### Version history

| Check | Result | Notes |
|-------|--------|-------|
| Load History | **Pass** | “No snapshots yet. Snapshots are created every 50 operations.” |
| Restore snapshot | **Not tested** | Revision ~5; threshold not reached |

### Browser / logs

| Check | Result |
|-------|--------|
| Major browser console errors | **None observed** in automation session |
| Network/auth/documents/AI routes | **Pass** during exercised flows |
| `docker compose logs server` | **Pass** — no crashes |
| `docker compose logs ai-service` | **Pass with warnings** — Chroma telemetry warnings only |
| `docker compose logs client` | **Pass** — Vite dev server ready |

### Post-teardown static checks — pass

`npm run check` (server), `npm run build` (client), `python -m py_compile config.py main.py rag_store.py` (ai-service).

### Still needs manual proof

- Two browsers/incognito profiles **at the same time**: simultaneous typing, delete, replace-over-selection.
- Visual confirmation of colored remote cursor/selection decorations.
- Snapshot restore after 50+ operations.
- Demo GIF / 3-minute video / public deployment URL.

---

## Strict deep-dive notes

### AI / RAG stack vs specification wording

| Spec item | What the repo actually does |
|-----------|----------------------------|
| LangChain | **Implemented** — `OpenAIEmbeddings` + `ChatOpenAI` wired when `AI_MOCK_MODE=false`. **Live OpenAI calls not validated** in this run. |
| ChromaDB | **Mock runtime validated** in Docker E2E. **OpenAI embedding collection not live-indexed** without a key. |
| `text-embedding-3-small` | **Configured** via `EMBEDDING_MODEL` default. **Not live-verified**. |
| `tiktoken` | **Verified locally** — `python rag_store.py` chunking self-test. |
| `gpt-4o-mini` | **Configured** via `OPENAI_MODEL` default. **Not live-verified**. |

### Collaboration / OT

| Area | Assessment |
|------|------------|
| Server OT | **Implemented** — `ot` package, transform against Redis history (`otEngine.js`, `websocketServer.js`). |
| Client OT | **Improved** — CodeMirror 6 `ChangeSet` → insert/delete (+ replace as delete+insert queue); no client-side ot.js transform. |
| Replace | **Supported** — client maps replace to delete+insert at adjusted positions; uncontrolled CodeMirror avoids controlled-value revert; full-document replace browser-verified. |
| Remote cursors | **Implemented** — `remoteCursorExtension.js` decorations; `CURSOR`/`CURSOR_UPDATE` exercised via WebSocket script; **colored caret not browser-screenshot-verified** in manual validation run. |
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
| Image architecture diagram | Yes (`docs/assets/architecture.svg`, linked from README) |
| Demo GIF | **Prepared** (no `03-two-user-collaboration.gif` committed yet) |
| Screenshot PNGs | **Prepared** (`docs/assets/screenshots/` + filenames; no captures committed) |
| Demo video | No |
| Live URL | No |

---

## Real OpenAI validation

**Branch:** `phase3-real-openai-validation`  
**Date:** 2026-05-25  
**Overall status:** **Implemented, Needs Manual Proof** — configuration and static checks pass; **no live OpenAI API calls** (no key in shell environment or local `ai-service/.env`)

### Configuration review (code + env templates)

| Item | Result | Evidence |
|------|--------|----------|
| `AI_MOCK_MODE=false` enables real mode | **Pass (static)** | `config.py` — `resolve_mock_mode()`; `main.py` `/health` returns `ai_mode: openai` |
| `OPENAI_API_KEY` required in real mode | **Pass (static)** | `config.py` — `require_openai_api_key()` raises when key missing and mock disabled |
| `OPENAI_MODEL` default | **Pass (static)** | `config.py` — default `gpt-4o-mini`; overridable via env |
| `EMBEDDING_MODEL` default | **Pass (static)** | `config.py` — default `text-embedding-3-small`; overridable via env |
| LangChain chat in real mode | **Pass (static)** | `main.py` — `ChatOpenAI` via `langchain_openai` |
| LangChain embeddings in real mode | **Pass (static)** | `rag_store.py` — `OpenAIEmbeddings` via `langchain_openai` |
| ChromaDB persistence | **Pass (mock runtime)** | Prior Docker E2E; separate `codebase_chunks_mock` vs `codebase_chunks_openai` collections |
| `tiktoken` chunking | **Pass (local)** | `python rag_store.py` self-test — function/class/fallback chunks with token counts |
| Mock mode preserved | **Pass (static)** | Default `AI_MOCK_MODE=true` in `.env.example`; mock branches unchanged in `main.py` |
| Secrets not committed | **Pass** | `ai-service/.env` gitignored; `.env.example` uses empty key placeholder |

### Live API validation

| Step | Result | Notes |
|------|--------|-------|
| `OPENAI_API_KEY` available locally | **Not available** | Shell env empty; `ai-service/.env` has no non-placeholder key |
| `GET /health` with `ai_mode: openai` | **Not run** | Requires key + `AI_MOCK_MODE=false` |
| `POST /index` with OpenAI embeddings | **Not run** | |
| `POST /complete` | **Not run** | |
| `POST /explain` | **Not run** | |
| `POST /chat` with RAG refs | **Not run** | |

### Static validation — pass

```bash
cd ai-service && python -m py_compile config.py main.py rag_store.py && python rag_store.py
cd ../server && npm run check
cd ../client && npm run build
```

### Local commands to validate real mode (when you have a key)

Do **not** commit `ai-service/.env` or print the key. Set variables in your shell or edit local `.env` only:

```powershell
# Option A: local ai-service process
cd ai-service
Copy-Item .env.example .env   # first time only; edit locally
# In ai-service/.env set: AI_MOCK_MODE=false and OPENAI_API_KEY=sk-... (your key)

pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000

# Option B: Docker (uses ai-service/.env via docker-compose.yml env_file)
docker compose up -d --build ai-service
```

Health (expect `ai_mode: "openai"`, `chat_model: "gpt-4o-mini"`, `embedding_model: "text-embedding-3-small"`):

```powershell
Invoke-RestMethod http://localhost:8000/health
```

Index, complete, explain, chat (PowerShell; replace `CODEBASE_ID` as needed):

```powershell
$codebaseId = "real-openai-validation-test"
$indexBody = @{
  codebase_id = $codebaseId
  files = @(@{
    filename = "sample.js"
    language = "javascript"
    content = "function add(a, b) { return a + b; }`nfunction multiply(x, y) { return x * y; }"
  })
} | ConvertTo-Json -Depth 5
Invoke-RestMethod -Method Post -Uri http://localhost:8000/index -ContentType "application/json" -Body $indexBody

$completeBody = @{
  code_context = "function add(a, b) { return a + b; }`n"
  cursor_position = 35
  language = "javascript"
  codebase_id = $codebaseId
} | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:8000/complete -ContentType "application/json" -Body $completeBody

$explainBody = @{
  selected_code = "function add(a, b) { return a + b; }"
  language = "javascript"
  codebase_id = $codebaseId
} | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:8000/explain -ContentType "application/json" -Body $explainBody

$chatBody = @{
  question = "Where is the add function defined?"
  code_context = "function add(a, b) { return a + b; }"
  language = "javascript"
  codebase_id = $codebaseId
} | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:8000/chat -ContentType "application/json" -Body $chatBody
```

**Pass criteria:** responses use `model: gpt-4o-mini` (not `mock-ai`), text is not mock template wording, and `rag_chunks` is non-empty after indexing.

See also [DEPLOYMENT.md](../DEPLOYMENT.md#real-openai-mode-validation-local).

---

## Remaining Tasks to Reach Exact 100% Project A Compliance

### Code tasks

1. **Optional:** PostgreSQL `sessions` table if spec requires server-side sessions beyond JWT.

### Testing / validation tasks

1. **Two-browser manual test** — same document, **simultaneous** typing (incognito + normal), capture evidence (GIF).
2. **WebSocket script** — `npm run test-ws` in Compose after clean build.
3. **Multi-instance Redis pub/sub** — two `server` replicas behind nginx/Redis (prove cross-instance fan-out).
4. **Real OpenAI path** — run [Real OpenAI validation](#real-openai-validation) commands with `AI_MOCK_MODE=false` and a valid key; update this audit when live calls succeed.
5. **Full regression** — complete [Full Docker E2E validation](#full-docker-e2e-validation) checklist with Docker running; optional `docker-compose.prod.yml` smoke test.

### Deployment tasks

1. **Deploy to Railway *or* AWS EC2** per spec (pick one; add minimal runbook).
2. **Publish working demo URL** — HTTPS, nginx or platform URL in README.
3. **Set production env vars** — `JWT_SECRET`, DB, Redis, `CLIENT_URL`, optional OpenAI key (secrets in platform, not git).
4. **Verify routes through proxy** — `/`, `/auth`, `/documents`, `/ai`, `/health`, `/ws`, `/ai-service/health`.

### Documentation / media tasks

1. ~~**Add image architecture diagram** to README~~ — done (`docs/assets/architecture.svg`).
2. **Capture demo GIF** — `docs/assets/screenshots/03-two-user-collaboration.gif` (see [SCREENSHOTS.md](SCREENSHOTS.md)).
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

**“Full-stack real-time collab editor with JWT, Redis OT history, WebSocket sync, snapshots, collaborators, in-editor remote cursors, FastAPI + LangChain/ChromaDB RAG (mock or real OpenAI modes), Docker/CI/nginx config — strong local prototype; full Compose E2E proof and public demo media still pending.”**

---

## Audit integrity statement

This document reflects **repository contents only**. Items marked **Needs Manual Proof** require human-run validation (Docker daemon, browser demo, hosting platform). Items marked **Missing** are not implemented in code paths reviewed. Do not claim 100% Project A compliance until the table rows and media/deployment gaps are closed.
