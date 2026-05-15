const express = require("express");
const { requireAuth } = require("./auth");
const { query } = require("./db");
const {
  listDocumentSnapshots,
  getDocumentSnapshot
} = require("./snapshotStore");

const router = express.Router();

async function canAccessDocument(documentId, userId) {
  const result = await query(
    `SELECT d.id
     FROM documents d
     LEFT JOIN document_collaborators dc ON d.id = dc.document_id
     WHERE d.id = $1 AND (d.owner_id = $2 OR dc.user_id = $2)`,
    [documentId, userId]
  );

  return result.rows.length > 0;
}

async function getDocumentByIdForUser(documentId, userId) {
  const result = await query(
    `SELECT d.id, d.title, d.content, d.owner_id, d.created_at, d.updated_at
     FROM documents d
     LEFT JOIN document_collaborators dc ON d.id = dc.document_id
     WHERE d.id = $1 AND (d.owner_id = $2 OR dc.user_id = $2)`,
    [documentId, userId]
  );

  return result.rows[0];
}

router.post("/", requireAuth, async (req, res) => {
  const { title, content } = req.body;

  if (!title || typeof title !== "string") {
    return res.status(400).json({
      error: "Document title is required"
    });
  }

  try {
    const result = await query(
      `INSERT INTO documents (title, content, owner_id)
       VALUES ($1, $2, $3)
       RETURNING id, title, content, owner_id, created_at, updated_at`,
      [title, content || "", req.user.userId]
    );

    return res.status(201).json({
      message: "Document created successfully",
      document: result.rows[0]
    });
  } catch (error) {
    console.error("Create document error:", error.message);

    return res.status(500).json({
      error: "Failed to create document"
    });
  }
});

router.get("/", requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT DISTINCT d.id, d.title, d.owner_id, d.created_at, d.updated_at
       FROM documents d
       LEFT JOIN document_collaborators dc ON d.id = dc.document_id
       WHERE d.owner_id = $1 OR dc.user_id = $1
       ORDER BY d.updated_at DESC`,
      [req.user.userId]
    );

    return res.status(200).json({
      documents: result.rows
    });
  } catch (error) {
    console.error("List documents error:", error.message);

    return res.status(500).json({
      error: "Failed to list documents"
    });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const document = await getDocumentByIdForUser(req.params.id, req.user.userId);

    if (!document) {
      return res.status(404).json({
        error: "Document not found"
      });
    }

    return res.status(200).json({
      document
    });
  } catch (error) {
    console.error("Get document error:", error.message);

    return res.status(500).json({
      error: "Failed to get document"
    });
  }
});

router.get("/:id/history", requireAuth, async (req, res) => {
  try {
    const hasAccess = await canAccessDocument(req.params.id, req.user.userId);

    if (!hasAccess) {
      return res.status(404).json({
        error: "Document not found"
      });
    }

    const snapshots = await listDocumentSnapshots(req.params.id, 10);

    return res.status(200).json({
      snapshots
    });
  } catch (error) {
    console.error("List document history error:", error.message);

    return res.status(500).json({
      error: "Failed to list document history"
    });
  }
});

router.post("/:id/restore/:snapshotId", requireAuth, async (req, res) => {
  try {
    const hasAccess = await canAccessDocument(req.params.id, req.user.userId);

    if (!hasAccess) {
      return res.status(404).json({
        error: "Document not found"
      });
    }

    const snapshot = await getDocumentSnapshot(req.params.snapshotId);

    if (!snapshot || snapshot.document_id !== req.params.id) {
      return res.status(404).json({
        error: "Snapshot not found"
      });
    }

    const result = await query(
      `UPDATE documents
       SET content = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, title, content, owner_id, created_at, updated_at`,
      [snapshot.content, req.params.id]
    );

    return res.status(200).json({
      message: "Document restored successfully",
      document: result.rows[0],
      restored_from: {
        snapshot_id: snapshot.id,
        revision: snapshot.revision,
        created_at: snapshot.created_at
      }
    });
  } catch (error) {
    console.error("Restore document snapshot error:", error.message);

    return res.status(500).json({
      error: "Failed to restore document snapshot"
    });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const document = await getDocumentByIdForUser(req.params.id, req.user.userId);

    if (!document) {
      return res.status(404).json({
        error: "Document not found"
      });
    }

    if (document.owner_id !== req.user.userId) {
      return res.status(403).json({
        error: "Only the document owner can delete this document"
      });
    }

    await query(
      `DELETE FROM documents
       WHERE id = $1`,
      [req.params.id]
    );

    return res.status(200).json({
      message: "Document deleted successfully",
      document: {
        id: document.id,
        title: document.title
      }
    });
  } catch (error) {
    console.error("Delete document error:", error.message);

    return res.status(500).json({
      error: "Failed to delete document"
    });
  }
});

module.exports = router;