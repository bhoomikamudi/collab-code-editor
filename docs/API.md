# API Reference

Base URL (local Docker Compose): `http://localhost:5000`

All protected routes require:

```http
Authorization: Bearer <jwt_token>
```

Full request/response examples can be explored with `curl` or the browser Network tab while using the app.

---

## Health

### `GET /health`

Public backend health check.

**Response `200`**

```json
{
  "status": "ok",
  "service": "collab-code-editor-server",
  "timestamp": "2026-01-01T12:00:00.000Z"
}
```

---

## Auth

### `POST /auth/register`

Create a user account.

**Body**

```json
{
  "email": "you@example.com",
  "password": "password123"
}
```

**Response `201`**

```json
{
  "message": "User registered successfully",
  "user": { "id": 1, "email": "you@example.com", "created_at": "..." },
  "token": "<jwt>"
}
```

### `POST /auth/login`

**Body** — same shape as register.

**Response `200`** — returns `user` and `token`.

### `GET /auth/me`

Requires JWT. Returns the current user profile.

---

## Documents

### `POST /documents`

Create a document.

**Body**

```json
{
  "title": "Untitled JavaScript File",
  "content": "function hello() {}"
}
```

### `GET /documents`

List documents owned by or shared with the current user.

Each document includes:

| Field | Description |
|-------|-------------|
| `owner_id` | Document owner UUID |
| `access_role` | `owner` or `collaborator` |
| `permission_level` | `write` for owners; `read` or `write` for collaborators |

### `GET /documents/:id`

Fetch one document by ID (owner or collaborator).

Returns the same `access_role` and `permission_level` fields as the list endpoint.

### `DELETE /documents/:id`

Delete a document (**owner only**). Collaborators receive `403`.

### `GET /documents/:id/collaborators`

List collaborators for a document. Requires document access (owner or collaborator).

**Response**

```json
{
  "collaborators": [
    {
      "user_id": "uuid",
      "email": "collaborator@example.com",
      "permission_level": "write",
      "created_at": "2026-05-24T12:00:00.000Z"
    }
  ]
}
```

### `POST /documents/:id/collaborators`

Add or update a collaborator (**owner only**).

**Body**

```json
{
  "email": "collaborator@example.com",
  "permission_level": "write"
}
```

`permission_level` must be `read` or `write`. The email must belong to a registered user.

### `DELETE /documents/:id/collaborators/:userId`

Remove a collaborator (**owner only**).

### Access rules

| Role | View / join WebSocket | Send `OPERATION` | Delete document | Manage collaborators |
|------|----------------------|------------------|-----------------|----------------------|
| Owner | Yes | Yes | Yes | Yes |
| Collaborator `write` | Yes | Yes | No | No |
| Collaborator `read` | Yes (read-only) | No | No | No |

`DOCUMENT_JOINED` includes `access_role`, `permission_level`, and `can_write` for the client UI.

### `GET /documents/:id/history`

List version snapshots for a document.

### `POST /documents/:id/restore/:snapshotId`

Restore document content from a snapshot and return the updated document (**owner or write collaborator**).

---

## AI (Node proxy)

The frontend calls these routes on the Node backend. The backend forwards requests to the FastAPI AI service.

### `POST /ai/index`

Index the current document into ChromaDB for RAG.

**Body**

```json
{
  "codebase_id": "user-1-document-3",
  "files": [
    {
      "filename": "example.js",
      "language": "javascript",
      "content": "function main() {}"
    }
  ]
}
```

### `POST /ai/complete`

Generate inline completion using editor context and optional RAG chunks.

**Body**

```json
{
  "code_context": "function hello() {\n  ",
  "cursor_position": 18,
  "language": "javascript",
  "instruction": "Complete the code at the cursor position using indexed codebase context.",
  "codebase_id": "user-1-document-3"
}
```

### `POST /ai/explain`

Explain a selected code snippet.

**Body**

```json
{
  "selected_code": "const x = 1;",
  "language": "javascript",
  "codebase_id": "user-1-document-3"
}
```

### `POST /ai/chat`

Ask a natural-language question about the indexed codebase.

**Body**

```json
{
  "question": "Where is the main logic?",
  "code_context": "...",
  "language": "javascript",
  "codebase_id": "user-1-document-3"
}
```

---

## AI service (internal)

Direct URL (local dev): `http://localhost:8000`

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | Service health |
| `POST` | `/index` | ChromaDB indexing |
| `POST` | `/complete` | Inline completion |
| `POST` | `/explain` | Selection explanation |
| `POST` | `/chat` | Codebase Q&A |

The browser should use the Node `/ai/*` proxy routes in normal operation.

---

## WebSocket

**Local URL:** `ws://localhost:5000`

**Production-style (nginx):** `ws://<host>/ws` — see [DEPLOYMENT.md](../DEPLOYMENT.md)

### Client → server

| Type | Purpose |
|------|---------|
| `JOIN_DOCUMENT` | Join a document room with JWT |
| `OPERATION` | Send insert/delete edit with client revision |
| `CURSOR` | Broadcast cursor/selection position |

### Server → client

| Type | Purpose |
|------|---------|
| `CONNECTED` | Initial connection acknowledgement |
| `DOCUMENT_JOINED` | Room joined; includes document, revision, presence |
| `OPERATION_ACK` | Confirms applied operation and revision |
| `REMOTE_OPERATION` | Another user's transformed operation |
| `CURSOR_UPDATE` | Another user's cursor/presence |
| `CURSOR_ACK` | Confirms local cursor update |
| `USER_JOINED` | User entered the document room |
| `USER_LEFT` | User disconnected |
| `ERROR` | Validation or authorization error |

### Example: join document

```json
{
  "type": "JOIN_DOCUMENT",
  "documentId": 1,
  "token": "<jwt>"
}
```

### Example: send operation

```json
{
  "type": "OPERATION",
  "revision": 4,
  "operation": {
    "type": "insert",
    "position": 0,
    "text": "// hello\n"
  }
}
```
