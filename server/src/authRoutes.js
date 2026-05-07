const express = require("express");
const { query } = require("./db");
const {
  hashPassword,
  comparePassword,
  createToken,
  requireAuth
} = require("./auth");

const router = express.Router();

function isValidEmail(email) {
  return typeof email === "string" && email.includes("@") && email.includes(".");
}

function isValidPassword(password) {
  return typeof password === "string" && password.length >= 8;
}

router.post("/register", async (req, res) => {
  const { email, password } = req.body;

  if (!isValidEmail(email)) {
    return res.status(400).json({
      error: "A valid email is required"
    });
  }

  if (!isValidPassword(password)) {
    return res.status(400).json({
      error: "Password must be at least 8 characters long"
    });
  }

  try {
    const existingUser = await query(
      "SELECT id FROM users WHERE email = $1",
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: "An account with this email already exists"
      });
    }

    const passwordHash = await hashPassword(password);

    const result = await query(
      `INSERT INTO users (email, password_hash)
       VALUES ($1, $2)
       RETURNING id, email, created_at`,
      [email.toLowerCase(), passwordHash]
    );

    const user = result.rows[0];
    const token = createToken(user);

    return res.status(201).json({
      message: "User registered successfully",
      user,
      token
    });
  } catch (error) {
    console.error("Register error:", error.message);

    return res.status(500).json({
      error: "Failed to register user"
    });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!isValidEmail(email) || typeof password !== "string") {
    return res.status(400).json({
      error: "Valid email and password are required"
    });
  }

  try {
    const result = await query(
      "SELECT id, email, password_hash, created_at FROM users WHERE email = $1",
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: "Invalid email or password"
      });
    }

    const user = result.rows[0];
    const isMatch = await comparePassword(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({
        error: "Invalid email or password"
      });
    }

    const safeUser = {
      id: user.id,
      email: user.email,
      created_at: user.created_at
    };

    const token = createToken(safeUser);

    return res.status(200).json({
      message: "Login successful",
      user: safeUser,
      token
    });
  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      error: "Failed to login"
    });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const result = await query(
      "SELECT id, email, created_at FROM users WHERE id = $1",
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "User not found"
      });
    }

    return res.status(200).json({
      user: result.rows[0]
    });
  } catch (error) {
    console.error("Me route error:", error.message);

    return res.status(500).json({
      error: "Failed to fetch user"
    });
  }
});

module.exports = router;