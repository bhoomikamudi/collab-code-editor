const express = require("express");
const { query } = require("./db");
const { requireAuth } = require("./auth");

const router = express.Router();

router.post("/", requireAuth, async (req, res) => {
  const { title, content } = req.body;

  if (typeof title !== "string" || title.trim().length === 0) {
    return res.status(400).json({
      error: "Document title is required"
    });
  }

  try {
    const result = await query(
      `INSERT INTO documents (title, content, owner_id)
       VALUES ($1, $2, $3)
       RETURNING id, title, content, owner_id, created_at, updated_at`,
      [title.trim(), content || "", req.user.userId]
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
  const documentId = req.params.id;

  try {
    const result = await query(
      `SELECT d.id, d.title, d.content, d.owner_id, d.created_at, d.updated_at
       FROM documents d
       LEFT JOIN document_collaborators dc ON d.id = dc.document_id
       WHERE d.id = $1 AND (d.owner_id = $2 OR dc.user_id = $2)`,
      [documentId, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Document not found"
      });
    }

    return res.status(200).json({
      document: result.rows[0]
    });
  } catch (error) {
    console.error("Get document error:", error.message);

    return res.status(500).json({
      error: "Failed to get document"
    });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  const documentId = req.params.id;

  try {
    const result = await query(
      `DELETE FROM documents
       WHERE id = $1 AND owner_id = $2
       RETURNING id, title`,
      [documentId, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Document not found or you do not have permission to delete it"
      });
    }

    return res.status(200).json({
      message: "Document deleted successfully",
      document: result.rows[0]
    });
  } catch (error) {
    console.error("Delete document error:", error.message);

    return res.status(500).json({
      error: "Failed to delete document"
    });
  }
});

module.exports = router;