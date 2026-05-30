# Upgraded Project 3 Compliance Audit

**Target spec:** *PROJECT 3 — Real-Time Collaborative Code Editor with AI Assistance: A Production Real-Time Distributed System*

**Branch audited:** `phase4-upgraded-project3-audit`  
**Audit date:** 2026-05-25  
**Method:** Static inspection of repository files, configs, and docs. No runtime claims unless prior audits documented them.

**Related:** This repo was built and audited against the earlier **Project A** spec. See [PROJECT_A_COMPLIANCE_AUDIT.md](./PROJECT_A_COMPLIANCE_AUDIT.md) for that baseline. **Project A ≠ Project 3.** Most Project A features exist as a local Docker prototype; Project 3 adds production distributed-system requirements that are largely **not implemented**.

---

## Executive summary

| Area | Project 3 expectation | Current repo |
|------|----------------------|--------------|
| **Overall alignment** | Production-grade distributed system | Strong **local prototype** (Project A scope) |
| **Backend** | Node.js **TypeScript** + C++ N-API OT | Node.js **JavaScript** runtime + **TypeScript foundation** (`tsconfig.json`, `src/types.ts`, `npm run typecheck`) |
| **Frontend** | **Next.js TypeScript** | **React + Vite** (JSX, no TypeScript) |
| **Real-time data** | **Redis Cluster** | Single **Redis 7** container |
| **AI transport** | **gRPC** (+ streaming) | **HTTP REST** proxy (`server/src/aiRoutes.js` → FastAPI) |
| **RAG intelligence** | **tree-sitter** AST chunking, **MLflow**, **RAGAS** | Regex + **tiktoken** chunking; ChromaDB embedded; **no MLflow/RAGAS** |
| **Persistence** | PostgreSQL **operations** table + snapshots | PostgreSQL users/docs/collaborators/snapshots; **ops only in Redis** |
| **Observability** | **OpenTelemetry**, **Jaeger**, **Prometheus**, **Grafana** | **None** in repo |
| **Orchestration** | **Kubernetes** + websocket-aware ingress | **Docker Compose** only; **no K8s manifests** |
| **Testing** | **Cypress E2E** (collab, reconnect, cursors, AI) | GitHub Actions **build/syntax only** |
| **Media / deployment** | Screenshots, GIF, video, **live URL** | Architecture **SVG** only; screenshot **folder prepared**; **0 PNG/GIF/video**; **no public URL** |

**Bottom line:** The repository is a credible Project A portfolio prototype. It does **not** satisfy upgraded Project 3 production/distributed requirements without substantial new work across TypeScript migration, native OT, gRPC, observability, K8s, and E2E testing.

---

## Current implementation (what actually exists)

### Repository layout

```text
collab-code-editor/
├── client/                 React 18 + Vite + Tailwind (JSX, not TypeScript)
├── server/                 Express + ws + ot.js (JavaScript)
├── ai-service/             FastAPI + LangChain + ChromaDB (Python)
├── deploy/nginx/           HTTP reverse proxy + WebSocket upgrade (no gRPC)
├── docs/                   API, demo script, audits, architecture.svg, screenshot checklist
├── .github/workflows/      ci.yml — client build, server check, AI py_compile
├── docker-compose.yml      postgres, redis, server, ai-service, client
└── docker-compose.prod.yml postgres, redis, server, ai-service, nginx
```

### Working capabilities (Project A / prototype level)

- JWT auth, document CRUD, collaborators (read/write), snapshots every 50 ops, restore
- WebSocket collaboration: insert/delete OT via `ot` npm + Redis op list + pub/sub fan-out
- CodeMirror 6 editor, remote cursor extension, queued local ops per `OPERATION_ACK`
- AI: Index / Complete / Explain / Chat via REST; mock mode default; real OpenAI wired but **not live-validated** with a key in audit runs
- Regex + tiktoken function/class-aware chunking (not AST/tree-sitter)
- Docker Compose local dev; prod-style nginx compose; GitHub Actions CI

### Explicitly absent for Project 3

- TypeScript (client/server), Next.js, C++ N-API, gRPC/protobuf, Redis Cluster, tree-sitter, MLflow, RAGAS, PostgreSQL `operations` table, OpenTelemetry, Jaeger, Prometheus, Grafana, Kubernetes, Cypress, AI streaming, separate ChromaDB/MLflow/Jaeger Compose services, load-balanced multi-replica gateway, WebSocket **reconnection with durable local queue replay**

---

## Requirement-by-requirement compliance table

| Requirement | Expected by upgraded Project 3 | Current repo status | Verdict | Recommended next action |
|-------------|-------------------------------|---------------------|---------|-------------------------|
| **Real-time collaborative editor** | Production-grade multi-user editing | CodeMirror + ws + OT prototype; manual browser validation partial | **Partial** | Harden OT + E2E before calling production-grade |
| **Node.js TypeScript backend** | Gateway/API/WS in TypeScript | `server/tsconfig.json` (strict, `allowJs`); `server/src/types.ts` shared types; `npm run typecheck` in CI; runtime still **JavaScript** (`src/*.js`) | **Partial** | Migrate auth/config → document routes → WebSocket/OT incrementally |
| **C++ OT module via Node N-API** | Native high-performance OT engine | `server/src/otEngine.js` uses npm `ot` in JavaScript | **Missing** | Phase 4B: design C++ OT + N-API bindings |
| **Redis Cluster** | Cluster for pub/sub + op history at scale | Single `redis:7-alpine` in both compose files | **Missing** | Phase 4G: Redis Cluster config or managed Redis; update clients |
| **Redis pub/sub** | Cross-instance event fan-out | `server/src/pubsub.js` — channel `collab:websocket:events` on single Redis | **Partial** | Extend after Cluster; multi-instance not load-tested |
| **Redis operation history** | Durable ordered op log | `server/src/operationStore.js` — Redis list `doc:{id}:ops` | **Partial** | Meets prototype; not Cluster; no PG backup |
| **gRPC Node ↔ Python AI** | Primary AI transport | `server/src/aiRoutes.js` — `fetch()` HTTP to FastAPI `:8000` | **Missing** | Phase 4C: `.proto` + gRPC server/client |
| **AI streaming over gRPC** | Streaming completion/chat | FastAPI returns full JSON; `invoke_langchain_llm` — no stream/SSE | **Missing** | Phase 4C: gRPC server-streaming + client UI |
| **Python FastAPI AI microservice** | RAG + LLM features | `ai-service/main.py` — `/index`, `/complete`, `/explain`, `/chat`, `/health` | **Partial** | Align transport (gRPC) and streaming |
| **LangChain RAG pipeline** | Embeddings + chat orchestration | `langchain_openai` in `main.py` + `rag_store.py` | **Partial** | Mock validated; real OpenAI **Needs Proof** |
| **ChromaDB vector store** | Vector retrieval | `chromadb.PersistentClient` inside ai-service container | **Partial** | Works embedded; Project 3 may expect separate service |
| **OpenAI gpt-4o-mini** | Chat/completions | Default `OPENAI_MODEL=gpt-4o-mini` when `AI_MOCK_MODE=false` | **Needs Proof** | Run live validation with key; document in audit |
| **OpenAI text-embedding-3-small** | Embeddings | Default `EMBEDDING_MODEL=text-embedding-3-small` | **Needs Proof** | Same as above |
| **tiktoken chunking** | Token-budget chunk packing | `rag_store.py` — `tiktoken.get_encoding`, `count_tokens` | **Complete** | Keep; complement with tree-sitter boundaries |
| **tree-sitter AST-aware chunking** | Parse-aware symbol boundaries | Regex boundaries in `rag_store.py` (`BOUNDARY_RULES`) | **Missing** | Phase 4D: tree-sitter parsers per language |
| **MLflow RAG experiment tracking** | Track indexing/eval runs | Not in `requirements.txt` or code | **Missing** | Phase 4D: MLflow server + logging hooks |
| **RAGAS evaluation tracking** | RAG quality metrics | Not in repo | **Missing** | Phase 4D: RAGAS eval pipeline + MLflow logging |
| **PostgreSQL users** | User accounts | `schema.sql` — `users` table | **Complete** | — |
| **PostgreSQL documents** | Document content/metadata | `documents` table | **Complete** | — |
| **PostgreSQL collaborators** | Share permissions | `document_collaborators` | **Complete** | — |
| **PostgreSQL snapshots** | Version history | `document_snapshots` | **Complete** | — |
| **PostgreSQL operations table** | Durable op audit/replay in PG | **No `operations` table**; ops only in Redis | **Missing** | Add schema + write path or justify Redis-only |
| **Next.js TypeScript frontend** | App router/pages + TS | `client/` — Vite + React JSX, no Next.js, no TS | **Missing** | Phase 4A: Next.js migration or spec waiver |
| **CodeMirror 6 editor** | Editor component | `@codemirror/*` via `@uiw/react-codemirror` | **Complete** | Port to Next.js when frontend migrates |
| **OT client logic** | Client-side op generation/queue | `collabOperations.js` + queued WS in `App.jsx` | **Partial** | Not full client-side OT transform; ack queue only |
| **Cursor presence visualization** | Remote caret/selection | `remoteCursorExtension.js` + WS `CURSOR` | **Partial** | Implemented; browser visual **Needs Proof** |
| **AI inline completion** | At-cursor completion | `handleAiComplete` → REST `/ai/complete` | **Partial** | Works via REST; not streaming |
| **Explain selection** | Selection explanation | `handleExplainSelection` → REST | **Partial** | Same |
| **Streaming codebase chat** | Token/stream UX | Single-shot JSON response in chat handler | **Missing** | gRPC/streaming + UI |
| **WebSocket collaboration** | Real-time sync | Native `ws` on server; client `WebSocket` | **Partial** | Production ingress/session affinity not proven |
| **Reconnection + local op queue** | Survive disconnect; replay pending ops | `onclose` sets Disconnected only; `pendingOperationsRef` for ack sequencing, **not reconnect replay** | **Missing** | Phase 4B/4F: reconnect backoff + queue persistence |
| **OpenTelemetry tracing** | Distributed traces | No OTel SDK in server, client, or ai-service | **Missing** | Phase 4E |
| **Jaeger** | Trace backend | Not in compose or docs as runnable service | **Missing** | Phase 4E: Jaeger container + OTel export |
| **Prometheus** | Metrics scrape | Not in compose | **Missing** | Phase 4E |
| **Grafana** | Dashboards | Not in compose | **Missing** | Phase 4E |
| **Nginx reverse proxy** | Edge routing | `deploy/nginx/default.conf` — static SPA, REST, `/ws` | **Partial** | No gRPC routes; single upstream (not LB pool) |
| **Nginx WebSocket routing** | WS upgrade + long timeout | `location /ws` with Upgrade headers | **Partial** | Exists; not validated behind K8s ingress |
| **Nginx gRPC routing** | gRPC to AI service | No `grpc_pass` or HTTP/2 gRPC config | **Missing** | Add when gRPC exists |
| **Load balancer** | Multi-gateway distribution | Single `server` upstream in nginx | **Missing** | Phase 4G: multiple server replicas + LB |
| **Kubernetes manifests** | Deployable K8s YAML | **No `k8s/` or `kubernetes/` directory** | **Missing** | Phase 4G: Deployments, Services, Ingress |
| **K8s websocket ingress + session affinity** | Sticky sessions for WS | Not present | **Missing** | Phase 4G: Ingress annotations / service affinity |
| **Docker Compose (full stack)** | postgres, redis, server, ai, frontend, prometheus, grafana, jaeger, mlflow, chromadb | **5 services:** postgres, redis, server, ai-service, client — **no** prometheus, grafana, jaeger, mlflow, standalone chromadb | **Partial** | Expand compose per Project 3 or document subset |
| **Cypress E2E** | Collab, reconnect, cursors, AI | No `cypress/` config or tests | **Missing** | Phase 4F |
| **GitHub Actions CI** | Automated checks | `.github/workflows/ci.yml` — build + syntax | **Partial** | Add E2E, typecheck, gRPC/OT tests later |
| **Comprehensive README** | Architecture, setup, ops | `README.md` — detailed for Project A scope | **Partial** | Extend for Project 3 stack when built |
| **Architecture diagram (image)** | Visual system diagram | `docs/assets/architecture.svg` embedded in README | **Complete** | Update diagram when architecture changes |
| **Screenshots / demo GIF** | Portfolio media in repo | `docs/assets/screenshots/` + checklist; **0 PNG/GIF committed** | **Prepared** | Capture from Docker demo; embed in README |
| **Demo video (3 min)** | Recorded walkthrough | `docs/DEMO_SCRIPT.md` only | **Missing** | Record after features stable |
| **Live deployment URL** | Public HTTPS demo | README disclaims public URL; none in docs | **Missing** | Deploy to cloud; add honest URL |

---

## Strict checks (explicit non-alignments)

| Upgraded requirement | What the repo has instead | Verdict |
|---------------------|---------------------------|---------|
| TypeScript backend | JavaScript runtime + TS tooling/types (`types.ts`, `typecheck`); full migration pending | **Partial** |
| Next.js frontend | React + Vite (`client/`) | **Missing** |
| C++ N-API OT | JavaScript `ot` npm (`otEngine.js`) | **Missing** |
| Redis Cluster | Single Redis container | **Missing** |
| gRPC / protobuf | HTTP REST (`aiRoutes.js` → FastAPI) | **Missing** |
| tree-sitter chunking | Regex + tiktoken (`rag_store.py`) | **Missing** |
| MLflow / RAGAS | Not present | **Missing** |
| PostgreSQL `operations` table | Redis list only | **Missing** |
| OpenTelemetry / Jaeger / Prometheus / Grafana | Not present | **Missing** |
| Kubernetes | Not present | **Missing** |
| Cypress E2E | Not present | **Missing** |
| AI streaming | Synchronous JSON responses | **Missing** |
| WebSocket reconnect queue | Disconnect UI only | **Missing** |
| Real OpenAI validated | Implemented, mock validated; key not used in audit | **Needs Proof** |
| Demo GIF | Checklist only, no `.gif` file | **Prepared**, not Complete |

---

## Prioritized implementation plan

Small, Cursor-friendly tasks grouped by phase. **Prompt estimates** = focused agent sessions (not calendar days).

### Phase 4A — TypeScript / frontend alignment (~8–12 prompts)

| # | Task | Depends on |
|---|------|------------|
| 1 | Add `tsconfig` + TypeScript to `server/`; convert `index.js`, `auth.js` | **Partial** — `tsconfig.json`, `types.ts`, CI `typecheck` done; runtime JS unchanged |
| 2 | Convert WebSocket + OT modules to TS with types for ops/messages | 1 |
| 3 | Convert document/auth routes and middleware to TS | 1 |
| 4 | Scaffold Next.js App Router + TypeScript in `frontend/` (or migrate `client/`) | — |
| 5 | Port CodeMirror editor + collab hooks to Next.js client components | 4 |
| 6 | Port Axios API client + JWT storage with typed DTOs | 4–5 |
| 7 | Update Docker/CI for TS build (`tsc`, `next build`) | 1–6 |
| 8 | Update architecture diagram + README for Next.js/TS stack | 4–7 |

### Phase 4B — OT engine hardening (~6–10 prompts)

| # | Task | Depends on |
|---|------|------------|
| 1 | Spec C++ OT API (insert/delete/transform) for N-API surface | — |
| 2 | Implement C++ core + `binding.gyp` / `node-addon-api` | 1 |
| 3 | Wire N-API module into TypeScript server; fallback to JS `ot` for dev | 2, 4A-2 |
| 4 | WebSocket reconnect with exponential backoff | 4A-2 |
| 5 | Persist pending local op queue across reconnect (memory + optional IndexedDB) | 4–5 |
| 6 | Replay queued ops after `DOCUMENT_JOINED` with revision catch-up | 5 |
| 7 | Benchmark / correctness tests vs current `otEngine.js` | 2–6 |

### Phase 4C — gRPC AI service (~6–9 prompts)

| # | Task | Depends on |
|---|------|------------|
| 1 | Define `ai.proto` (Index, Complete, Explain, Chat, health) | — |
| 2 | FastAPI or standalone Python gRPC servicer implementing RAG/LLM | 1 |
| 3 | Add `@grpc/grpc-js` client in Node; replace `aiRoutes` HTTP proxy | 1–2, 4A |
| 4 | Server-streaming RPC for chat (and optional complete) | 2–3 |
| 5 | Next.js/client consumer for streaming chat UI | 4, 4A-5 |
| 6 | nginx gRPC routing (HTTP/2) or internal cluster-only gRPC | 4G optional |
| 7 | Integration tests: index → retrieve → complete/chat | 3–5 |

### Phase 4D — tree-sitter + MLflow RAG (~5–8 prompts)

| # | Task | Depends on |
|---|------|------------|
| 1 | Add tree-sitter grammars (JS/TS/Python minimum) | — |
| 2 | Replace regex boundaries in `split_code_into_chunks` with AST walks | 1 |
| 3 | Add MLflow to compose + log index params, chunk counts, embedding model | — |
| 4 | Add RAGAS eval script (sample Q/A set) + log metrics to MLflow | 3 |
| 5 | Optional: standalone ChromaDB service in compose | — |
| 6 | Document mock vs real OpenAI eval procedure | 3–4 |

### Phase 4E — Observability (~5–7 prompts)

| # | Task | Depends on |
|---|------|------------|
| 1 | OpenTelemetry SDK in Node gateway (HTTP + WS spans) | 4A |
| 2 | OTel in FastAPI ai-service | — |
| 3 | Jaeger + OTLP collector in `docker-compose.yml` | 1–2 |
| 4 | Prometheus scrape configs for Node/Python | 1–2 |
| 5 | Grafana dashboards (latency, WS connections, AI errors) | 3–4 |
| 6 | Trace propagation through gRPC (after Phase 4C) | 4C, 1–2 |

### Phase 4F — Cypress E2E (~4–6 prompts)

| # | Task | Depends on |
|---|------|------------|
| 1 | Cypress + compose test profile (or `docker compose up` in CI job) | — |
| 2 | Auth + create document + editor smoke | 1 |
| 3 | Two-user collaboration spec (or simulated WS helper) | 2 |
| 4 | Reconnection spec (disconnect network; assert queue replay) | 4B-5 |
| 5 | Remote cursor presence assertion | 2–3 |
| 6 | AI panel: index, complete, chat (mock mode) | 2 |

### Phase 4G — Kubernetes / deployment (~6–10 prompts)

| # | Task | Depends on |
|---|------|------------|
| 1 | K8s manifests: postgres, redis (or external), server Deployment | 4A |
| 2 | ai-service Deployment + gRPC Service | 4C |
| 3 | Ingress: REST + `/ws` with session affinity | 1 |
| 4 | Redis Cluster or managed Redis wiring | — |
| 5 | nginx or Ingress gRPC routes | 4C |
| 6 | Horizontal Pod Autoscaler for server (optional) | 1–3 |
| 7 | Helm chart or Kustomize overlay (optional) | 1–6 |
| 8 | Cloud deploy runbook (Railway/EKS/GKE) + **real URL** | 1–7 |

### Phase 4H — Demo media / final polish (~3–5 prompts)

| # | Task | Depends on |
|---|------|------------|
| 1 | Capture `docs/assets/screenshots/*.png` + collaboration GIF | stable demo |
| 2 | Embed media in README; update audits to Complete where true | 1 |
| 3 | Record 3-minute demo video per `DEMO_SCRIPT.md` | 1 |
| 4 | Final pass on `UPGRADED_PROJECT3_COMPLIANCE_AUDIT.md` | all phases |
| 5 | Live OpenAI validation run + audit update | key available |

---

## Estimated total effort (Cursor prompts)

| Phase | Focus | Est. prompts |
|-------|--------|--------------|
| 4A | TypeScript + Next.js alignment | 8–12 |
| 4B | C++ OT + reconnection | 6–10 |
| 4C | gRPC + streaming AI | 6–9 |
| 4D | tree-sitter + MLflow/RAGAS | 5–8 |
| 4E | Observability | 5–7 |
| 4F | Cypress E2E | 4–6 |
| 4G | Kubernetes + deployment | 6–10 |
| 4H | Media + polish | 3–5 |
| **Total** | | **~43–67 focused prompts** |

Phases can overlap (e.g. 4E after 4A; 4C before 4G). **Minimum viable Project 3 slice** might be: 4A (partial) + 4C + 4E (basic) + 4F + 4G (single-cluster demo) ≈ **25–35 prompts**.

---

## Suggested next prompts (immediate)

1. **Phase 4A-1 (continued):** Migrate `auth.js` + config helpers to TypeScript; keep `allowJs` until WebSocket/OT modules move last.  
2. **Phase 4C-1:** Draft `proto/ai.proto` and document gRPC migration from `aiRoutes.js`.  
3. **Phase 4F-1:** Add Cypress with one login + open-document smoke against Docker Compose.  
4. **Phase 4H-1:** Capture `01-login.png` and `03-two-user-collaboration.gif` per [SCREENSHOTS.md](./SCREENSHOTS.md).

---

## Audit integrity statement

- **Complete** = requirement fully met **as specified for Project 3 production/distributed scope**, with evidence in repo.  
- **Partial** = related prototype or subset exists; not production-aligned.  
- **Missing** = no meaningful implementation.  
- **Needs Proof** = code path exists but not validated in documented test runs (e.g. real OpenAI, remote cursor screenshot).

This audit does **not** claim Project 3 compliance. The current codebase remains best described as a **Project A local prototype** moving toward Project 3.
