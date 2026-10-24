const { pool, query } = require("../config/db");

// Reads the module registry and writes the values a user enters against it.
//
// Nothing here knows which modules exist. Every list comes from the
// `modules` table and its satellites, so a module added by seeding appears
// in the API and the input form without a line of this file changing.

// ---------------------------------------------------------------- reading

async function listModules({ includeDisabled = false } = {}) {
  const { rows } = await query(
    `SELECT code, name, description, purpose, display_order, enabled
     FROM modules
     ${includeDisabled ? "" : "WHERE enabled = TRUE"}
     ORDER BY display_order, code`
  );
  return rows;
}

// The questions to put to the user, grouped by module. This is what the
// input form is built from.
async function listParameters({ includeInactive = false } = {}) {
  const { rows } = await query(
    `SELECT p.module_code, m.name AS module_name, m.display_order AS module_order,
            p.code, p.label, p.unit, p.value_type, p.enum_values, p.help_text,
            p.required, p.display_order
     FROM module_parameters p
     JOIN modules m ON m.code = p.module_code
     ${includeInactive ? "" : "WHERE p.active = TRUE AND m.enabled = TRUE"}
     ORDER BY m.display_order, p.display_order, p.code`
  );
  return rows;
}

async function listConstants() {
  const { rows } = await query(
    `SELECT module_code, code, label, value, unit, applies_to, expects_unit,
            result_unit, tags, source, citation, source_url, version,
            verified, notes
     FROM module_constants
     WHERE active = TRUE
     ORDER BY module_code, code`
  );
  return rows;
}

async function listLimits() {
  const { rows } = await query(
    `SELECT module_code, code, label, subject, selector, comparison, value,
            value_max, unit, is_index, source, citation, source_url, version,
            verified, notes
     FROM module_limits
     WHERE active = TRUE
     ORDER BY module_code, code`
  );
  return rows;
}

async function listOutputs() {
  const { rows } = await query(
    `SELECT o.module_code, o.code, o.label, o.unit, o.formula_text,
            o.operation, o.comparable, o.limitation_note, o.display_order
     FROM module_outputs o
     JOIN modules m ON m.code = o.module_code
     WHERE o.active = TRUE
     ORDER BY m.display_order, o.display_order, o.code`
  );
  return rows;
}

/**
 * The whole registry, nested as the analytics service expects it.
 *
 * Disabled modules are included with `enabled: false` rather than filtered
 * out. The engine needs to know they exist so it can report which modules
 * it skipped, instead of silently producing fewer results.
 */
async function loadDefinitions() {
  const [modules, parameters, constants, limits, outputs] = await Promise.all([
    listModules({ includeDisabled: true }),
    listParameters({ includeInactive: true }),
    listConstants(),
    listLimits(),
    listOutputs(),
  ]);

  const group = (rows) => {
    const byModule = new Map();
    for (const row of rows) {
      if (!byModule.has(row.module_code)) byModule.set(row.module_code, []);
      byModule.get(row.module_code).push(row);
    }
    return byModule;
  };

  const parametersByModule = group(parameters);
  const constantsByModule = group(constants);
  const limitsByModule = group(limits);
  const outputsByModule = group(outputs);

  return modules.map((module) => ({
    code: module.code,
    name: module.name,
    enabled: module.enabled,
    parameters: (parametersByModule.get(module.code) ?? []).map((p) => ({
      code: p.code,
      label: p.label,
      unit: p.unit,
      value_type: p.value_type,
      required: p.required,
    })),
    constants: (constantsByModule.get(module.code) ?? []).map((c) => ({
      code: c.code,
      label: c.label,
      // node-pg returns NUMERIC as a string to avoid losing precision. The
      // engine needs a number, and these values have at most ten decimal
      // places, so a double represents them exactly enough to multiply.
      value: Number(c.value),
      unit: c.unit,
      applies_to: c.applies_to,
      expects_unit: c.expects_unit,
      result_unit: c.result_unit,
      tags: c.tags ?? {},
      source: c.source,
      version: c.version,
      verified: c.verified,
    })),
    limits: (limitsByModule.get(module.code) ?? []).map((l) => ({
      code: l.code,
      label: l.label,
      subject: l.subject,
      selector: l.selector ?? {},
      comparison: l.comparison,
      value: Number(l.value),
      value_max: l.value_max === null ? null : Number(l.value_max),
      unit: l.unit,
      is_index: l.is_index,
      source: l.source,
      version: l.version,
      verified: l.verified,
    })),
    outputs: (outputsByModule.get(module.code) ?? []).map((o) => ({
      code: o.code,
      label: o.label,
      unit: o.unit,
      formula_text: o.formula_text,
      operation: o.operation,
      comparable: o.comparable,
      limitation_note: o.limitation_note,
    })),
  }));
}

// ----------------------------------------------------- parameter values

async function listParameterValues(assessmentId) {
  const { rows } = await query(
    `SELECT v.id, v.parameter_code, v.value_numeric, v.value_text, v.unit,
            v.reporting_period, v.source_status, v.source_reference,
            v.observed_on, v.method, v.assumption, v.updated_at,
            p.label, p.module_code, p.unit AS expected_unit
     FROM assessment_parameter_values v
     JOIN module_parameters p ON p.code = v.parameter_code
     WHERE v.assessment_id = $1
     ORDER BY p.module_code, p.display_order, p.code`,
    [assessmentId]
  );
  return rows;
}

/**
 * Saves answers, one row per question, replacing any previous answer to the
 * same question.
 *
 * A value of null with source_status 'UNAVAILABLE' is a valid answer and is
 * stored: it records that the question was seen and could not be answered,
 * which is what makes the result NOT_CALCULATED_MISSING_INPUT rather than
 * indistinguishable from a question nobody reached.
 */
async function saveParameterValues(assessmentId, values, enteredBy = null) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const saved = [];
    for (const value of values) {
      const { rows } = await client.query(
        `INSERT INTO assessment_parameter_values
           (assessment_id, parameter_code, value_numeric, value_text, unit,
            reporting_period, source_status, source_reference, observed_on,
            method, assumption, entered_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (assessment_id, parameter_code) DO UPDATE SET
           value_numeric    = EXCLUDED.value_numeric,
           value_text       = EXCLUDED.value_text,
           unit             = EXCLUDED.unit,
           reporting_period = EXCLUDED.reporting_period,
           source_status    = EXCLUDED.source_status,
           source_reference = EXCLUDED.source_reference,
           observed_on      = EXCLUDED.observed_on,
           method           = EXCLUDED.method,
           assumption       = EXCLUDED.assumption,
           entered_by       = EXCLUDED.entered_by,
           updated_at       = CURRENT_TIMESTAMP
         RETURNING *`,
        [
          assessmentId,
          value.parameterCode,
          value.valueNumeric ?? null,
          value.valueText ?? null,
          value.unit ?? null,
          value.reportingPeriod ?? null,
          value.sourceStatus ?? "USER_REPORTED",
          value.sourceReference ?? null,
          value.observedOn ?? null,
          value.method ?? null,
          value.assumption ?? null,
          enteredBy,
        ]
      );
      saved.push(rows[0]);
    }

    await client.query("COMMIT");
    return saved;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  listModules,
  listParameters,
  listConstants,
  listLimits,
  listOutputs,
  loadDefinitions,
  listParameterValues,
  saveParameterValues,
};
