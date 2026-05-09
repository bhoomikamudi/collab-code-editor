const express = require("express");
const { requireAuth } = require("./auth");

const router = express.Router();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://ai-service:8000";

async function forwardToAiService(path, payload) {
  const response = await fetch(`${AI_SERVICE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.detail || "AI service request failed");
    error.statusCode = response.status;
    throw error;
  }

  return data;
}

router.post("/index", requireAuth, async (req, res) => {
  const { codebase_id, files } = req.body;

  if (typeof codebase_id !== "string" || codebase_id.length === 0) {
    return res.status(400).json({
      error: "codebase_id is required"
    });
  }

  if (!Array.isArray(files) || files.length === 0) {
    return res.status(400).json({
      error: "files must be a non-empty array"
    });
  }

  try {
    const data = await forwardToAiService("/index", {
      codebase_id,
      files
    });

    return res.status(200).json(data);
  } catch (error) {
    console.error("AI indexing proxy error:", error.message);

    return res.status(error.statusCode || 500).json({
      error: error.message || "Failed to connect to AI service"
    });
  }
});

router.post("/complete", requireAuth, async (req, res) => {
  const {
    code_context,
    cursor_position,
    language,
    instruction,
    codebase_id
  } = req.body;

  if (typeof code_context !== "string" || code_context.length === 0) {
    return res.status(400).json({
      error: "code_context is required"
    });
  }

  if (!Number.isInteger(cursor_position) || cursor_position < 0) {
    return res.status(400).json({
      error: "cursor_position must be a valid number"
    });
  }

  try {
    const data = await forwardToAiService("/complete", {
      code_context,
      cursor_position,
      language: language || "javascript",
      instruction,
      codebase_id
    });

    return res.status(200).json({
      completion: data.completion,
      model: data.model,
      language: data.language,
      rag_chunks: data.rag_chunks || []
    });
  } catch (error) {
    console.error("AI completion proxy error:", error.message);

    return res.status(error.statusCode || 500).json({
      error: error.message || "Failed to connect to AI service"
    });
  }
});

router.post("/explain", requireAuth, async (req, res) => {
  const { selected_code, language, codebase_id } = req.body;

  if (typeof selected_code !== "string" || selected_code.length === 0) {
    return res.status(400).json({
      error: "selected_code is required"
    });
  }

  try {
    const data = await forwardToAiService("/explain", {
      selected_code,
      language: language || "javascript",
      codebase_id
    });

    return res.status(200).json({
      explanation: data.explanation,
      model: data.model,
      language: data.language,
      rag_chunks: data.rag_chunks || []
    });
  } catch (error) {
    console.error("AI explanation proxy error:", error.message);

    return res.status(error.statusCode || 500).json({
      error: error.message || "Failed to connect to AI service"
    });
  }
});

router.post("/chat", requireAuth, async (req, res) => {
  const { question, code_context, language, codebase_id } = req.body;

  if (typeof question !== "string" || question.length === 0) {
    return res.status(400).json({
      error: "question is required"
    });
  }

  try {
    const data = await forwardToAiService("/chat", {
      question,
      code_context: code_context || "",
      language: language || "javascript",
      codebase_id
    });

    return res.status(200).json({
      answer: data.answer,
      model: data.model,
      language: data.language,
      rag_chunks: data.rag_chunks || []
    });
  } catch (error) {
    console.error("AI chat proxy error:", error.message);

    return res.status(error.statusCode || 500).json({
      error: error.message || "Failed to connect to AI service"
    });
  }
});

module.exports = router;