const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL pool error:", err);
});

// Helper for simple queries; use pool.connect() directly for transactions.
async function query(text, params) {
  return pool.query(text, params);
}

module.exports = { pool, query };
