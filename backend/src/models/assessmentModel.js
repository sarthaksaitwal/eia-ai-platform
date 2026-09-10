const { pool, query } = require("../config/db");

const VALID_CATEGORIES = ["Air", "Water", "Ecology", "Carbon", "Resource", "Waste", "Noise"];

async function createAssessment(projectId, { methodologyVersion } = {}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: numRows } = await client.query(
      `SELECT COALESCE(MAX(assessment_number), 0) + 1 AS next_number
       FROM assessments WHERE project_id = $1`,
      [projectId]
    );
    const nextNumber = numRows[0].next_number;

    const { rows } = await client.query(
      `INSERT INTO assessments (project_id, assessment_number, methodology_version)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [projectId, nextNumber, methodologyVersion ?? null]
    );

    await client.query("COMMIT");
    return rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function listAssessmentsByProject(projectId) {
  const { rows } = await query(
    `SELECT * FROM assessments WHERE project_id = $1 ORDER BY assessment_number DESC`,
    [projectId]
  );
  return rows;
}

// Verifies an assessment belongs to a project owned by the given user, in one query.
async function findAssessmentForUser(assessmentId, userId) {
  const { rows } = await query(
    `SELECT a.*
     FROM assessments a
     JOIN projects p ON p.id = a.project_id
     WHERE a.id = $1 AND p.user_id = $2`,
    [assessmentId, userId]
  );
  return rows[0] || null;
}

async function addAssessmentInputs(assessmentId, inputs) {
  // inputs: [{ category, parameterName, valueNumeric, valueText, unit, source }, ...]
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const inserted = [];
    for (const input of inputs) {
      if (!VALID_CATEGORIES.includes(input.category)) {
        throw new Error(`Invalid input category: ${input.category}`);
      }
      const { rows } = await client.query(
        `INSERT INTO assessment_inputs
           (assessment_id, category, parameter_name, value_numeric, value_text, unit, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          assessmentId,
          input.category,
          input.parameterName,
          input.valueNumeric ?? null,
          input.valueText ?? null,
          input.unit ?? null,
          input.source ?? null,
        ]
      );
      inserted.push(rows[0]);
    }
    await client.query("COMMIT");
    return inserted;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function listAssessmentInputs(assessmentId) {
  const { rows } = await query(
    `SELECT * FROM assessment_inputs WHERE assessment_id = $1 ORDER BY category, parameter_name`,
    [assessmentId]
  );
  return rows;
}

// Consolidated read used by the dashboard: everything downstream of an assessment.
async function getAssessmentDetail(assessmentId) {
  const [
    assessment,
    inputs,
    environmentalData,
    gisResults,
    impactResults,
    recommendations,
    reports,
  ] = await Promise.all([
    query(`SELECT * FROM assessments WHERE id = $1`, [assessmentId]).then((r) => r.rows[0]),
    query(`SELECT * FROM assessment_inputs WHERE assessment_id = $1 ORDER BY category`, [assessmentId]).then((r) => r.rows),
    query(`SELECT * FROM environmental_data WHERE assessment_id = $1 ORDER BY category`, [assessmentId]).then((r) => r.rows),
    query(`SELECT * FROM gis_analysis_results WHERE assessment_id = $1 ORDER BY feature_type`, [assessmentId]).then((r) => r.rows),
    query(
      `SELECT ir.*, cr.rule_code, cr.rule_name
       FROM impact_results ir
       JOIN calculation_rules cr ON cr.id = ir.rule_id
       WHERE ir.assessment_id = $1
       ORDER BY ir.factor`,
      [assessmentId]
    ).then((r) => r.rows),
    query(`SELECT * FROM recommendations WHERE assessment_id = $1 ORDER BY priority`, [assessmentId]).then((r) => r.rows),
    query(`SELECT * FROM reports WHERE assessment_id = $1 ORDER BY created_at DESC`, [assessmentId]).then((r) => r.rows),
  ]);

  if (!assessment) return null;

  return {
    ...assessment,
    inputs,
    environmental_data: environmentalData,
    gis_results: gisResults,
    impact_results: impactResults,
    recommendations,
    reports,
  };
}

async function updateAssessmentStatus(assessmentId, { status, overallScore, riskLevel, startedAt, completedAt }) {
  const { rows } = await query(
    `UPDATE assessments
     SET status = COALESCE($2, status),
         overall_score = COALESCE($3, overall_score),
         risk_level = COALESCE($4, risk_level),
         started_at = COALESCE($5, started_at),
         completed_at = COALESCE($6, completed_at),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING *`,
    [assessmentId, status ?? null, overallScore ?? null, riskLevel ?? null, startedAt ?? null, completedAt ?? null]
  );
  return rows[0] || null;
}

module.exports = {
  createAssessment,
  listAssessmentsByProject,
  findAssessmentForUser,
  addAssessmentInputs,
  listAssessmentInputs,
  getAssessmentDetail,
  updateAssessmentStatus,
  VALID_CATEGORIES,
};
