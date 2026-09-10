const { query } = require("../config/db");

const ALLOWED_ROLES = [
  "PROJECT_DEVELOPER",
  "ENVIRONMENTAL_CONSULTANT",
  "SUSTAINABILITY_OFFICER",
  "ADMIN",
];

async function createUser({ name, email, passwordHash, role, organization }) {
  const { rows } = await query(
    `INSERT INTO users (name, email, password_hash, role, organization)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, email, role, organization, is_active, created_at`,
    [name, email, passwordHash, role, organization ?? null]
  );
  return rows[0];
}

async function findUserByEmail(email) {
  const { rows } = await query(
    `SELECT id, name, email, password_hash, role, organization, is_active, created_at
     FROM users WHERE email = $1`,
    [email]
  );
  return rows[0] || null;
}

async function findUserById(id) {
  const { rows } = await query(
    `SELECT id, name, email, role, organization, is_active, created_at
     FROM users WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

module.exports = { createUser, findUserByEmail, findUserById, ALLOWED_ROLES };
