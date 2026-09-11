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

// Comparison limits (NAAQS, ambient noise, ...). Rows with verified = FALSE have
// not been checked against the notification text, so a caller must not present
// them as a compliance statement.
async function listStandards({ category, parameterName, zone, standardName, verifiedOnly } = {}) {
  const conditions = ["active = TRUE"];
  const values = [];

  if (category) {
    values.push(category);
    conditions.push(`category = $${values.length}`);
  }
  if (parameterName) {
    values.push(parameterName);
    conditions.push(`parameter_name = $${values.length}`);
  }
  if (zone) {
    // Limits stored as 'All' apply to every zone.
    values.push(zone);
    conditions.push(`(zone = $${values.length} OR zone = 'All')`);
  }
  if (standardName) {
    values.push(standardName);
    conditions.push(`standard_name = $${values.length}`);
  }
  if (verifiedOnly) {
    conditions.push("verified = TRUE");
  }

  const { rows } = await query(
    `SELECT * FROM regulatory_standards
     WHERE ${conditions.join(" AND ")}
     ORDER BY category, parameter_name, zone, averaging_period`,
    values
  );
  return rows;
}

module.exports = { listCoefficients, listRules, listStandards };
