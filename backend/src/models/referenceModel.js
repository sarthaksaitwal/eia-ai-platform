const { query } = require("../config/db");

async function listCoefficients({ industry, factor } = {}) {
  const conditions = ["active = TRUE"];
  const values = [];

  if (industry) {
    values.push(industry);
    conditions.push(`industry = $${values.length}`);
  }
  if (factor) {
    values.push(factor);
    conditions.push(`factor = $${values.length}`);
  }

  const { rows } = await query(
    `SELECT * FROM engineering_coefficients WHERE ${conditions.join(" AND ")} ORDER BY industry, factor`,
    values
  );
  return rows;
}

async function listRules({ factor } = {}) {
  const conditions = ["active = TRUE"];
  const values = [];

  if (factor) {
    values.push(factor);
    conditions.push(`factor = $${values.length}`);
  }

  const { rows } = await query(
    `SELECT * FROM calculation_rules WHERE ${conditions.join(" AND ")} ORDER BY factor`,
    values
  );
  return rows;
}

module.exports = { listCoefficients, listRules };
