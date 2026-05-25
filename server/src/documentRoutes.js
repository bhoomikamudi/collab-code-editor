const express = require("express");
const { requireAuth } = require("./auth");
const { query } = require("./db");
const {
  listDocumentSnapshots,
  getDocumentSnapshot
} = require("./snapshotStore");
const {
  getDocumentAccess,
  listDocumentsForUser,
  isDocumentOwner,
  listDocumentCollaborators,
  validatePermissionLevel,
  canWriteAccess
} = require("./documentAccess");

const router = express.Router();

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

    const document = {
      ...result.rows[0],
      access_role: "owner",
      permission_level: "write"
    };

    return res.status(201).json({
      message: "Document created successfully",
      document
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
    const documents = await listDocumentsForUser(req.user.userId);

    return res.status(200).json({
      documents
    });
  } catch (error) {
    console.error("List documents error:", error.message);

    return res.status(500).json({
      error: "Failed to list documents"
    });
  }
});

router.get("/:id/collaborators", requireAuth, async (req, res) => {
  try {
    const access = await getDocumentAccess(req.params.id, req.user.userId);

    if (!access) {
      return res.status(404).json({
        error: "Document not found"
      });
    }

    const collaborators = await listDocumentCollaborators(req.params.id);

    return res.status(200).json({
      collaborators
    });
  } catch (error) {
    console.error("List collaborators error:", error.message);

    return res.status(500).json({
      error: "Failed to list collaborators"
    });
  }
});

router.post("/:id/collaborators", requireAuth, async (req, res) => {
  const { email, permission_level: permissionLevel } = req.body;

  if (!email || typeof email !== "string") {
    return res.status(400).json({
      error: "Collaborator email is required"
    });
  }

  if (!validatePermissionLevel(permissionLevel)) {
    return res.status(400).json({
      error: "permission_level must be read or write"
    });
  }

  try {
    const owner = await isDocumentOwner(req.params.id, req.user.userId);

    if (!owner) {
      return res.status(403).json({
        error: "Only the document owner can manage collaborators"
      });
    }

    const userResult = await query(
      `SELECT id, email FROM users WHERE LOWER(email) = LOWER($1)`,
      [email.trim()]
    );

    const collaboratorUser = userResult.rows[0];

    if (!collaboratorUser) {
      return res.status(404).json({
        error: "No registered user found with that email"
      });
    }

    if (collaboratorUser.id === req.user.userId) {
      return res.status(400).json({
        error: "You cannot add yourself as a collaborator"
      });
    }

    await query(
      `INSERT INTO document_collaborators (document_id, user_id, permission_level)
       VALUES ($1, $2, $3)
       ON CONFLICT (document_id, user_id)
       DO UPDATE SET permission_level = EXCLUDED.permission_level`,
      [req.params.id, collaboratorUser.id, permissionLevel]
    );

    const collaborators = await listDocumentCollaborators(req.params.id);

    return res.status(201).json({
      message: "Collaborator added successfully",
      collaborator: {
        user_id: collaboratorUser.id,
        email: collaboratorUser.email,
        permission_level: permissionLevel
      },
      collaborators
    });
  } catch (error) {
    console.error("Add collaborator error:", error.message);

    return res.status(500).json({
      error: "Failed to add collaborator"
    });
  }
});

router.delete("/:id/collaborators/:userId", requireAuth, async (req, res) => {
  try {
    const owner = await isDocumentOwner(req.params.id, req.user.userId);

    if (!owner) {
      return res.status(403).json({
        error: "Only the document owner can manage collaborators"
      });
    }

    const deleteResult = await query(
      `DELETE FROM document_collaborators
       WHERE document_id = $1 AND user_id = $2
       RETURNING user_id`,
      [req.params.id, req.params.userId]
    );

    if (deleteResult.rows.length === 0) {
      return res.status(404).json({
        error: "Collaborator not found"
      });
    }

    const collaborators = await listDocumentCollaborators(req.params.id);

    return res.status(200).json({
      message: "Collaborator removed successfully",
      collaborators
    });
  } catch (error) {
    console.error("Remove collaborator error:", error.message);

    return res.status(500).json({
      error: "Failed to remove collaborator"
    });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const access = await getDocumentAccess(req.params.id, req.user.userId);

    if (!access) {
      return res.status(404).json({
        error: "Document not found"
      });
    }

    return res.status(200).json({
      document: access.document
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
    const access = await getDocumentAccess(req.params.id, req.user.userId);

    if (!access) {
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
    const access = await getDocumentAccess(req.params.id, req.user.userId);

    if (!access) {
      return res.status(404).json({
        error: "Document not found"
      });
    }

    if (!canWriteAccess(access)) {
      return res.status(403).json({
        error: "You have read-only access to this document"
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

    const document = {
      ...result.rows[0],
      access_role: access.access_role,
      permission_level: access.permission_level
    };

    return res.status(200).json({
      message: "Document restored successfully",
      document,
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
    const access = await getDocumentAccess(req.params.id, req.user.userId);

    if (!access) {
      return res.status(404).json({
        error: "Document not found"
      });
    }

    if (access.access_role !== "owner") {
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
        id: access.document.id,
        title: access.document.title
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
