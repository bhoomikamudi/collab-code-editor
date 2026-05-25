# Screenshot and GIF Checklist

Capture these assets for a portfolio README, LinkedIn post, or interview slide deck. Store files under `docs/assets/` (create the folder locally; binary assets are optional to commit).

Suggested format: PNG for UI, GIF or MP4 for motion (collaboration, restore).

---

## 1. Dashboard and editor

| Asset | What to capture |
|-------|-----------------|
| `01-login.png` | Login/register screen with Project A badge and dark theme |
| `02-document-sidebar.png` | Logged-in view: document list, create form, user email |
| `03-editor-workspace.png` | Full workspace: CodeMirror, toolbar buttons, revision, connection pill |

**Tip:** Use a wide laptop viewport (~1440px) so sidebar + editor + AI panel are visible.

---

## 2. Real-time collaboration

| Asset | What to capture |
|-------|-----------------|
| `04-two-tabs-side-by-side.png` | Same document open in two browser windows |
| `05-collab-sync.gif` | Typing in left tab; text appearing in right tab |
| `06-presence-panel.png` | Presence footer showing two active user emails |

---

## 3. AI assistant

| Asset | What to capture |
|-------|-----------------|
| `07-index-rag-status.png` | Status bar after **Index for RAG** succeeds |
| `08-ai-complete.png` | Completion in editor + AI panel |
| `09-explain-selection.png` | Selected code + explanation in Explain tab |
| `10-codebase-chat.png` | Chat question, answer, and **RAG References** list |

---

## 4. Version history

| Asset | What to capture |
|-------|-----------------|
| `11-version-history.png` | Snapshot list with revision numbers and timestamps |
| `12-restore-before-after.png` | Editor content before/after **Restore** (two-panel or split) |

---

## 5. Engineering credibility

| Asset | What to capture |
|-------|-----------------|
| `13-github-actions-ci.png` | GitHub Actions run: frontend build, backend check, AI service check (green) |
| `14-architecture-snippet.png` | README architecture diagram section or IDE file tree |
| `15-deployment-files.png` | `docker-compose.prod.yml`, `deploy/nginx/default.conf` in editor |

---

## 6. Optional terminal shots

| Asset | What to capture |
|-------|-----------------|
| `16-docker-compose-up.png` | `docker compose up -d --build` with healthy containers |
| `17-health-checks.png` | `curl localhost:5000/health` and `curl localhost:8000/health` |

---

## Naming and embedding

After capture, reference images from `README.md` if you commit them:

```markdown
![Editor workspace](./docs/assets/03-editor-workspace.png)
```

Do not commit secrets, `.env` files, or real API keys in screenshots.
