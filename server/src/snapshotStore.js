const { query } = require("./db");

async function createDocumentSnapshot({
  documentId,
  content,
  revision,
  createdBy
}) {
  const result = await query(
    `INSERT INTO document_snapshots (document_id, content, revision, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING id, document_id, content, revision, created_by, created_at`,
    [documentId, content, revision, createdBy]
  );

  return result.rows[0];
}

async function listDocumentSnapshots(documentId, limit = 10) {
  const result = await query(
    `SELECT id, document_id, revision, created_by, created_at,
            LEFT(content, 300) AS preview
     FROM document_snapshots
     WHERE document_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [documentId, limit]
  );

  return result.rows;
}

async function getDocumentSnapshot(snapshotId) {
  const result = await query(
    `SELECT id, document_id, content, revision, created_by, created_at
     FROM document_snapshots
     WHERE id = $1`,
    [snapshotId]
  );

  return result.rows[0];
}

module.exports = {
  createDocumentSnapshot,
  listDocumentSnapshots,
  getDocumentSnapshot
};