const { pool, query } = require("../config/db");

// Persists engine runs and their results.
//
// A run is recorded before the engine is called and closed afterwards, so a
// crash mid-run leaves a row with status 'running' rather than no trace at
// all. The snapshots are what make a result reproducible after the
// reference data has moved on.

async function startRun(assessmentId, { engineVersion, triggeredBy, inputSnapshot }) {
  const { rows } = await query(
    `INSERT INTO calculation_runs
       (assessment_id, engine_version, status, input_snapshot, triggered_by)
     VALUES ($1, $2, 'running', $3, $4)
     RETURNING *`,
    [assessmentId, engineVersion, JSON.stringify(inputSnapshot ?? null), triggeredBy ?? null]
  );
  return rows[0];
}

async function failRun(runId, message) {
  const { rows } = await query(
    `UPDATE calculation_runs
     SET status = 'failed', error_message = $2, completed_at = CURRENT_TIMESTAMP,
         duration_ms = GREATEST(0, EXTRACT(MILLISECONDS FROM (CURRENT_TIMESTAMP - started_at))::INTEGER)
     WHERE id = $1
     RETURNING *`,
    [runId, message]
  );
  return rows[0];
}

/**
 * Stores the engine's results and closes the run, in one transaction.
 *
 * If any result violates a constraint, nothing is stored and the run is
 * left open for the caller to fail. A half-written run would be worse than
 * none: the summary would not match the rows.
 */
async function completeRun(runId, assessmentId,
  { results, summary, referenceSnapshot, durationMs, engineVersion }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // The ON CONFLICT below is what makes storing the same run twice safe:
    // uq_module_results_run_output means one row per output per run, and a
    // repeat updates it in place.
    for (const result of results) {
      await client.query(
        `INSERT INTO module_results
           (run_id, assessment_id, module_code, output_code, value_numeric,
            value_text, unit, status, missing_inputs, comparison, limit_code,
            limit_value, limit_unit, inputs_used, constants_used,
            formula_text, limitation_note, provisional)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
                 $15, $16, $17, $18)
         ON CONFLICT (run_id, output_code) DO UPDATE SET
           value_numeric   = EXCLUDED.value_numeric,
           value_text      = EXCLUDED.value_text,
           unit            = EXCLUDED.unit,
           status          = EXCLUDED.status,
           missing_inputs  = EXCLUDED.missing_inputs,
           comparison      = EXCLUDED.comparison,
           limit_code      = EXCLUDED.limit_code,
           limit_value     = EXCLUDED.limit_value,
           limit_unit      = EXCLUDED.limit_unit,
           inputs_used     = EXCLUDED.inputs_used,
           constants_used  = EXCLUDED.constants_used,
           formula_text    = EXCLUDED.formula_text,
           limitation_note = EXCLUDED.limitation_note,
           provisional     = EXCLUDED.provisional,
           calculated_at   = CURRENT_TIMESTAMP`,
        [
          runId,
          assessmentId,
          result.module_code,
          result.output_code,
          result.value_numeric ?? null,
          result.value_text ?? null,
          result.unit ?? null,
          result.status,
          result.missing_inputs ? JSON.stringify(result.missing_inputs) : null,
          result.comparison ?? "not_compared",
          result.limit_code ?? null,
          result.limit_value ?? null,
          result.limit_unit ?? null,
          result.inputs_used ? JSON.stringify(result.inputs_used) : null,
          // The outputs a derived result was built from belong with the
          // provenance, so they travel in the same column rather than
          // needing one of their own.
          JSON.stringify({
            constants: result.constants_used ?? [],
            limits: result.limits_used ?? [],
            derived_from: result.derived_from ?? [],
            detail: result.detail ?? null,
          }),
          result.formula_text ?? null,
          result.limitation_note ?? null,
          result.provisional ?? false,
        ]
      );
    }

    // engine_version is recorded here rather than at startRun, because only
    // the engine knows which build answered.
    const { rows } = await client.query(
      `UPDATE calculation_runs
       SET status = 'completed', summary = $2, reference_snapshot = $3,
           duration_ms = $4,
           engine_version = COALESCE($5, engine_version),
           completed_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [runId, JSON.stringify(summary ?? {}), JSON.stringify(referenceSnapshot ?? null),
        durationMs ?? null, engineVersion ?? null]
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

async function latestRun(assessmentId) {
  const { rows } = await query(
    `SELECT * FROM calculation_runs
     WHERE assessment_id = $1
     ORDER BY started_at DESC
     LIMIT 1`,
    [assessmentId]
  );
  return rows[0] || null;
}

async function listRuns(assessmentId) {
  const { rows } = await query(
    `SELECT id, engine_version, status, summary, started_at, completed_at,
            duration_ms, error_message
     FROM calculation_runs
     WHERE assessment_id = $1
     ORDER BY started_at DESC`,
    [assessmentId]
  );
  return rows;
}

// Results joined to the module registry, ordered for display. The join is
// what keeps the ordering in the database rather than hard-coded here.
async function listResults(runId) {
  const { rows } = await query(
    `SELECT r.module_code, m.name AS module_name, r.output_code, r.value_numeric,
            r.value_text, r.unit, r.status, r.missing_inputs, r.comparison,
            r.limit_code, r.limit_value, r.limit_unit, r.inputs_used,
            r.constants_used, r.formula_text, r.limitation_note,
            r.provisional, r.calculated_at,
            o.label, o.operation
     FROM module_results r
     JOIN modules m ON m.code = r.module_code
     LEFT JOIN module_outputs o ON o.code = r.output_code
     WHERE r.run_id = $1
     ORDER BY m.display_order, o.display_order, r.output_code`,
    [runId]
  );
  return rows;
}

module.exports = {
  startRun,
  failRun,
  completeRun,
  latestRun,
  listRuns,
  listResults,
};
