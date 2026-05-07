const fs = require("fs");
const path = require("path");
require("dotenv").config();

const { pool } = require("./db");

async function initDatabase() {
  try {
    const schemaPath = path.join(__dirname, "schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf8");

    await pool.query(schema);

    console.log("Database schema initialized successfully");
  } catch (error) {
    console.error("Failed to initialize database schema:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

initDatabase();