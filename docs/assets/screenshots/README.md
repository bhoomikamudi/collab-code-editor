# Screenshot and demo GIF assets

This folder holds **real captures** from the local Docker demo. Do not commit placeholder or generated images.

## Expected files

| File | Capture |
|------|---------|
| `01-login.png` | Landing / login screen |
| `02-editor-dashboard.png` | Logged-in editor workspace (sidebar, share panel, revision, connection) |
| `03-two-user-collaboration.gif` | Two users editing the same document (side-by-side or sequential proof) |
| `04-remote-cursor.png` | Remote cursor / selection indicator visible in CodeMirror |
| `05-ai-rag-panel.png` | AI assistant panel with RAG references |
| `06-version-history.png` | Version history list and/or restore result |
| `07-ci-passing.png` | GitHub Actions CI workflow run (green) |

## How to capture

1. Follow [docs/SCREENSHOTS.md](../../SCREENSHOTS.md) for the full checklist.
2. Run `docker compose up -d --build` and complete `npm run init-db` on the server container.
3. Use two browser profiles or incognito for collaboration shots.
4. Save PNG/GIF files here with the exact names above.
5. Uncomment the embed blocks in the root [README.md](../../../README.md) **Demo Screenshots** section.

**Do not** include `.env` contents, API keys, or real passwords in captures.
