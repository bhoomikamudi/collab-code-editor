const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function query(text, params) {
  const start = Date.now();

  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    console.log("Executed query", {
      text,
      duration,
      rows: result.rowCount
    });

    return result;
  } catch (error) {
    console.error("Database query error", {
      text,
      message: error.message
    });

    throw error;
  }
}

module.exports = {
  pool,
  query
};