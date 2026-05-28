# Screenshot and demo GIF capture checklist

Use this checklist to capture **real** portfolio assets from a local Docker demo. Save files under `docs/assets/screenshots/` using the exact filenames below, then embed them in [README.md](../README.md#demo-screenshots).

**Do not** commit fake screenshots, generated mockups, or images that were not captured from this application.

---

## Prerequisites

```bash
docker compose up -d --build
docker compose exec server npm run init-db   # first run only
```

| URL | Purpose |
|-----|---------|
| http://localhost:3000 | Frontend |
| http://localhost:5000/health | Backend health |
| http://localhost:8000/health | AI service health (`ai_mode: mock` is fine) |

**Two-user collaboration:** use a second browser, incognito window, or profile. Register two accounts, share a document (write permission), open the same doc in both sessions.

**Recording GIFs:** OBS, ScreenToGif, or similar — keep file size reasonable (&lt; 10 MB if possible).

---

## Required assets (recommended filenames)

| File | Checklist item | What to capture |
|------|----------------|-----------------|
| `01-login.png` | Landing / login screen | Register/login UI, Project A badge, dark theme — no real secrets in fields |
| `02-editor-dashboard.png` | Editor dashboard | Document list, CodeMirror editor, toolbar, revision, **Connected** status, **collaborator sharing UI** (email + Write/Read + Add collaborator) |
| `03-two-user-collaboration.gif` | Two-user collaboration | Typing in one session; same text appearing in the other (insert/delete). Show both windows or cut between them |
| `04-remote-cursor.png` | Remote cursor indicator | Colored remote caret/label and/or selection highlight while another user moves cursor |
| `05-ai-rag-panel.png` | AI assistant + RAG references | After **Index for RAG**: show Complete/Explain/Chat, answer text, and **RAG References** line ranges |
| `06-version-history.png` | Version history / restore | **Load History** with snapshot list or empty state + 50-op message; optional before/after **Restore** |
| `07-ci-passing.png` | GitHub Actions CI passing | Actions tab: `ci.yml` run green (client build, server check, AI py_compile) |

### Architecture diagram (no screenshot needed)

The vector architecture diagram is already in the repo:

- `docs/assets/architecture.svg` — embedded in README **Architecture** section

---

## Capture notes by area

### 1. Login and dashboard

- **01-login.png** — wide viewport (~1280px+), centered card visible.
- **02-editor-dashboard.png** — include left sidebar, editor chrome, right AI panel; owner document with share form visible.

### 2. Collaboration

- **03-two-user-collaboration.gif** — 10–20 seconds; show revision increment or status “Saved at revision N” if visible.
- **04-remote-cursor.png** — both users in the same document room; move selection in one window, capture the other.

### 3. AI / RAG

- **05-ai-rag-panel.png** — use mock mode unless you intentionally demo real OpenAI; ensure RAG refs show filenames like `YourFile.js:1-10`.

### 4. Version history

- **06-version-history.png** — if no snapshots yet, capture the honest empty copy (“Snapshots are created every 50 operations”).

### 5. CI

- **07-ci-passing.png** — crop to workflow name, commit, and green checkmarks; no tokens or secrets in the screenshot.

---

## Optional extra assets

| File | Purpose |
|------|---------|
| `08-collaborator-read-only.png` | Read-only collaborator: “read-only editor” label, editor not editable |
| `09-docker-healthy.png` | `docker compose ps` or Desktop showing all services running |
| `10-health-checks.png` | Terminal with `/health` JSON (redact nothing sensitive) |

---

## Embedding in README

After capture, add or uncomment lines in README **Demo Screenshots**:

```markdown
![Login](docs/assets/screenshots/01-login.png)
![Editor dashboard](docs/assets/screenshots/02-editor-dashboard.png)
![Two-user collaboration](docs/assets/screenshots/03-two-user-collaboration.gif)
![Remote cursor](docs/assets/screenshots/04-remote-cursor.png)
![AI and RAG panel](docs/assets/screenshots/05-ai-rag-panel.png)
![Version history](docs/assets/screenshots/06-version-history.png)
![CI passing](docs/assets/screenshots/07-ci-passing.png)
```

---

## Quality checklist before commit

- [ ] Every image is a **real** capture from `localhost:3000` (or CI/GitHub in browser).
- [ ] No `.env`, API keys, or JWT tokens visible.
- [ ] Filenames match the table above.
- [ ] GIF demonstrates actual sync, not a static mockup.
- [ ] README embed paths are relative and correct.
- [ ] Do not claim a demo GIF exists in docs unless `03-two-user-collaboration.gif` is committed.
