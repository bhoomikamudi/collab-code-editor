const { query } = require("./db");

const WRITE_PERMISSIONS = new Set(["write", "editor"]);
const VALID_PERMISSION_LEVELS = new Set(["read", "write"]);

function normalizePermissionLevel(level) {
  if (!level || level === "editor") {
    return "write";
  }

  if (level === "read" || level === "write") {
    return level;
  }

  return "read";
}

function canWriteAccess(access) {
  if (!access) {
    return false;
  }

  if (access.access_role === "owner") {
    return true;
  }

  return WRITE_PERMISSIONS.has(access.permission_level);
}

function attachAccessFields(documentRow, userId) {
  const isOwner = documentRow.owner_id === userId;

  return {
    ...documentRow,
    access_role: isOwner ? "owner" : "collaborator",
    permission_level: isOwner
      ? "write"
      : normalizePermissionLevel(documentRow.collaborator_permission)
  };
}

async function getDocumentAccess(documentId, userId) {
  const result = await query(
    `SELECT d.id, d.title, d.content, d.owner_id, d.created_at, d.updated_at,
            dc.permission_level AS collaborator_permission
     FROM documents d
     LEFT JOIN document_collaborators dc
       ON d.id = dc.document_id AND dc.user_id = $2
     WHERE d.id = $1 AND (d.owner_id = $2 OR dc.user_id = $2)`,
    [documentId, userId]
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  const document = attachAccessFields(row, userId);
  delete document.collaborator_permission;

  return {
    document,
    access_role: document.access_role,
    permission_level: document.permission_level,
    can_read: true,
    can_write: canWriteAccess({
      access_role: document.access_role,
      permission_level: document.permission_level
    })
  };
}

async function listDocumentsForUser(userId) {
  const result = await query(
    `SELECT d.id, d.title, d.owner_id, d.created_at, d.updated_at,
            dc.permission_level AS collaborator_permission
     FROM documents d
     LEFT JOIN document_collaborators dc
       ON d.id = dc.document_id AND dc.user_id = $1
     WHERE d.owner_id = $1 OR dc.user_id = $1
     ORDER BY d.updated_at DESC`,
    [userId]
  );

  return result.rows.map((row) => {
    const document = attachAccessFields(row, userId);
    delete document.collaborator_permission;
    return document;
  });
}

async function isDocumentOwner(documentId, userId) {
  const result = await query(
    `SELECT id FROM documents WHERE id = $1 AND owner_id = $2`,
    [documentId, userId]
  );

  return result.rows.length > 0;
}

async function listDocumentCollaborators(documentId) {
  const result = await query(
    `SELECT u.id AS user_id, u.email, dc.permission_level, dc.created_at
     FROM document_collaborators dc
     INNER JOIN users u ON u.id = dc.user_id
     WHERE dc.document_id = $1
     ORDER BY dc.created_at ASC`,
    [documentId]
  );

  return result.rows.map((row) => ({
    user_id: row.user_id,
    email: row.email,
    permission_level: normalizePermissionLevel(row.permission_level),
    created_at: row.created_at
  }));
}

function validatePermissionLevel(permissionLevel) {
  return VALID_PERMISSION_LEVELS.has(permissionLevel);
}

module.exports = {
  normalizePermissionLevel,
  validatePermissionLevel,
  canWriteAccess,
  getDocumentAccess,
  listDocumentsForUser,
  isDocumentOwner,
  listDocumentCollaborators
};
