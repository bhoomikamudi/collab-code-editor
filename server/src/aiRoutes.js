const express = require("express");
const { requireAuth } = require("./auth");

const router = express.Router();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://ai-service:8000";

router.post("/complete", requireAuth, async (req, res) => {
  const { code_context, cursor_position, language, instruction } = req.body;

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
    const response = await fetch(`${AI_SERVICE_URL}/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        code_context,
        cursor_position,
        language: language || "javascript",
        instruction
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.detail || "AI service request failed"
      });
    }

    return res.status(200).json({
      completion: data.completion,
      model: data.model,
      language: data.language
    });
  } catch (error) {
    console.error("AI completion proxy error:", error.message);

    return res.status(500).json({
      error: "Failed to connect to AI service"
    });
  }
});

module.exports = router;