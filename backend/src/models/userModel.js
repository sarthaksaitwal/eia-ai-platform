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

// The caller resolves every field before calling: a PATCH that leaves one
// out keeps what is stored, and working that out needs the current row, which
// the controller has already read.
async function updateUser(id, { name, organization, role }) {
  const { rows } = await query(
    `UPDATE users
        SET name = $2,
            organization = $3,
            role = $4,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, name, email, role, organization, is_active, created_at`,
    [id, name, organization, role]
  );
  return rows[0] || null;
}

// findUserById deliberately leaves the hash out, so anything that needs it
// has to ask for it by name rather than receive it by accident.
async function findPasswordHashById(id) {
  const { rows } = await query(`SELECT password_hash FROM users WHERE id = $1`, [id]);
  return rows[0] ? rows[0].password_hash : null;
}

async function updatePassword(id, passwordHash) {
  const { rowCount } = await query(
    `UPDATE users
        SET password_hash = $2,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = $1`,
    [id, passwordHash]
  );
  return rowCount > 0;
}

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  findPasswordHashById,
  updateUser,
  updatePassword,
  ALLOWED_ROLES,
};
