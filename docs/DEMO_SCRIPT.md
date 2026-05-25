# 3-Minute Demo Script

Use this script for a recruiter demo, portfolio walkthrough, or interview screen share. All steps assume the local Docker Compose stack is running.

**Prep (before recording)**

```bash
docker compose up -d --build
docker compose run --rm server npm run init-db
```

Open `http://localhost:3000` in Chrome or Edge.

---

## 0:00 — Intro (15 seconds)

> "This is Project A: a full-stack real-time collaborative code editor with JWT auth, operational transformation, Redis-backed sync, and an AI assistant with RAG indexing. Everything runs locally in Docker."

---

## 0:15 — Login (20 seconds)

1. Show the login screen (dark Tailwind UI).
2. Register or log in (for example `test@example.com` / `password123`).
3. Point out the document sidebar and session restore via JWT.

**Say:** "Auth is JWT-based; the Axios client attaches the token to REST calls."

---

## 0:35 — Create and open a document (25 seconds)

1. Enter a title such as `Demo Collaboration.js`.
2. Click **Create Document**.
3. Select the new document in the sidebar.
4. Show the CodeMirror editor, revision counter, and **Connected** status pill.

**Say:** "Documents live in PostgreSQL; the editor connects over WebSocket after selection."

---

## 1:00 — Real-time collaboration (40 seconds)

1. Copy the browser URL.
2. Open a **second browser tab** (or incognito window) and log in with another account, **or** use the same account in two tabs for a quick sync demo.
3. Open the **same document** in both tabs.
4. Type in tab A; show the update appearing in tab B.
5. Point to **Presence** at the bottom of the editor showing active emails.

**Say:** "Edits go through WebSocket operations, are transformed with ot.js on the server, stored in Redis history, and broadcast to peers. Cursor presence uses Redis with TTL cleanup."

---

## 1:40 — Index for RAG (20 seconds)

1. In one tab, click **Index for RAG**.
2. Show the status message confirming chunks indexed.

**Say:** "The Node backend proxies to FastAPI, which chunks the file and stores embeddings in ChromaDB for retrieval."

---

## 2:00 — AI features (50 seconds)

### AI Complete

1. Place the cursor in the editor.
2. Click **AI Complete**.
3. Show completion text in the AI panel and inserted code in the editor.

### Explain Selection

1. Select a few lines of code.
2. Click **Explain Selection**.
3. Show the explanation in the **Explain** tab.

### Codebase Chat

1. Switch to the **Chat** tab.
2. Ask: "Where is the main logic in this file?"
3. Click **Ask Codebase**.
4. Show the answer and **RAG References** filenames/lines.

**Say:** "Mock AI mode works without a paid API key; set `USE_MOCK_AI=false` and add `OPENAI_API_KEY` for real model calls."

---

## 2:50 — Version history and restore (30 seconds)

1. Make several edits (or use **AI Complete**) to increase the revision count.
2. Click **Load History**.
3. Show snapshot cards (created every **50 operations**).
4. Click **Restore** on an older snapshot.
5. Confirm editor content reverts and status updates.

**Say:** "Snapshots are persisted in PostgreSQL; restore reloads content through the REST API."

---

## 2:45 — Two-tab insert / delete / replace (collaboration)

1. Open the same document in **two browser tabs** (same account, or two accounts if you have collaborators).
2. Confirm both show **Connected** and the revision counter increases on edits.
3. **Tab A:** type new characters → **Tab B** should show the insert within a second.
4. **Tab A:** select a word and press **Delete** or **Backspace** → **Tab B** should remove the same range.
5. **Tab A:** select a line or word and type replacement text (overwrite selection) → **Tab B** should show the replaced text (client sends delete then insert).
6. **Tab B:** make a complementary edit at a different position → both tabs should stay consistent.

**Say:** "Replace-over-selection is synced as delete-then-insert over WebSocket OT; revisions advance on each ack."

---

## 3:00 — Remote cursor and selection indicators

1. Keep the same two tabs on the same document (ideally **two different accounts** so each tab is a distinct color).
2. In **Tab A**, click to move the caret — **Tab B** should show a **colored vertical caret** and a small **email label** above it.
3. In **Tab A**, drag to select a range — **Tab B** should show a **lightly highlighted selection** in that user’s color (plus the caret at the head).
4. Point to the footer **Presence:** line — emails still list active users (panel unchanged).

**Say:** "Cursor updates use CURSOR / CURSOR_UPDATE over WebSocket with Redis TTL presence; decorations are visual only and do not change document revisions."

**Note:** Two tabs with the **same login** may hide your own remote caret (filtered locally). Use two accounts for the clearest demo.

---

## 3:20 — Engineering wrap-up (optional, if time)

Quickly mention:

- GitHub Actions CI (frontend build + backend/AI syntax checks)
- [DEPLOYMENT.md](../DEPLOYMENT.md) for nginx production-style Compose
- Honest scope: prototype-level OT (insert/delete/replace via delete+insert queue), not full Google Docs-scale CRDT

---

## Troubleshooting during a live demo

| Issue | Fix |
|-------|-----|
| WebSocket disconnected | Refresh after selecting a document; check `docker compose logs server` |
| AI errors | Confirm `USE_MOCK_AI=true` in `ai-service/.env` |
| No snapshots | Need 50+ operations between snapshots; use typing or AI Complete |
| Second tab not syncing | Ensure both tabs joined the same document |
| Replace not appearing in other tab | Select text, type over it (not only append); check revision increments in both tabs |
| No colored caret in other tab | Use two different accounts, or confirm Tab B is connected; move caret (selection change sends CURSOR) |
