const { query } = require("./db");

async function getDocumentById(documentId) {
  const result = await query(
    `SELECT id, title, content, owner_id, created_at, updated_at
     FROM documents
     WHERE id = $1`,
    [documentId]
  );

  return result.rows[0];
}

async function updateDocumentContent(documentId, content) {
  const result = await query(
    `UPDATE documents
     SET content = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2
     RETURNING id, title, content, owner_id, created_at, updated_at`,
    [content, documentId]
  );

  return result.rows[0];
}

module.exports = {
  getDocumentById,
  updateDocumentContent
};