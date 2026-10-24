const { runCalculations, AnalyticsServiceError } = require("../clients/analyticsClient");
const { getAssessmentContext } = require("../models/environmentalDataModel");
const calculationModel = require("../models/calculationModel");
const moduleModel = require("../models/moduleModel");

// Orchestrates one engine run: gather, call, persist.
//
// The split is the one the rest of the platform uses. This backend owns the
// data and the durability; the analytics service owns the arithmetic and
// holds nothing. So everything the engine needs is read here and sent to
// it, and everything it returns is written here.

/**
 * Facts about the site rather than answers to questions.
 *
 * The noise zone is the reason this exists. It is recorded once, on
 * project_locations.area_classification, when the site is described. Asking
 * for it again as a module parameter would create a second place for it to
 * live and a way for the two to disagree.
 */
function siteContext(assessment) {
  return {
    area_classification: assessment.area_classification ?? null,
    ecologically_sensitive: assessment.ecologically_sensitive ?? null,
    industry: assessment.industry ?? null,
    project_type: assessment.project_type ?? null,
  };
}

function toEngineValues(rows) {
  return rows.map((row) => ({
    parameter_code: row.parameter_code,
    label: row.label,
    // node-pg hands back NUMERIC as a string. Number(null) is 0, which is
    // exactly the silent zero this platform must never produce, so the null
    // is preserved explicitly.
    value_numeric: row.value_numeric === null ? null : Number(row.value_numeric),
    value_text: row.value_text,
    unit: row.unit,
    source_status: row.source_status,
    reporting_period: row.reporting_period,
  }));
}

/**
 * What the run was given, kept so its results can be re-derived later even
 * after the reference data has been updated underneath them.
 */
function referenceSnapshot(definitions) {
  return definitions.map((module) => ({
    module_code: module.code,
    enabled: module.enabled,
    constants: module.constants.map((c) => ({
      code: c.code, value: c.value, unit: c.unit,
      version: c.version, verified: c.verified,
    })),
    limits: module.limits.map((l) => ({
      code: l.code, value: l.value, unit: l.unit,
      version: l.version, verified: l.verified,
    })),
  }));
}

/**
 * Runs every output of every enabled module for one assessment and stores
 * the results.
 *
 * Returns the completed run and its results. Throws when the engine is
 * unreachable or the write fails; in both cases the run row is marked
 * failed first, so a failure leaves a record rather than a gap.
 */
async function calculateAssessment(assessmentId, { triggeredBy = null } = {}) {
  const assessment = await getAssessmentContext(assessmentId);
  if (!assessment) {
    const err = new Error("Assessment not found.");
    err.status = 404;
    throw err;
  }

  const [definitions, valueRows] = await Promise.all([
    moduleModel.loadDefinitions(),
    moduleModel.listParameterValues(assessmentId),
  ]);

  const values = toEngineValues(valueRows);
  const context = siteContext(assessment);

  const run = await calculationModel.startRun(assessmentId, {
    // Overwritten with the engine's own version once it answers. Recorded
    // now so a run that never completes still says what started it.
    engineVersion: "pending",
    triggeredBy,
    inputSnapshot: { context, values },
  });

  let response;
  try {
    response = await runCalculations({
      assessment_id: assessmentId,
      context,
      modules: definitions,
      values,
    });
  } catch (err) {
    await calculationModel.failRun(run.id, err.message);
    throw err;
  }

  if (response.error) {
    await calculationModel.failRun(run.id, response.error);
    throw new AnalyticsServiceError(`Calculation engine failed: ${response.error}`);
  }

  try {
    const completed = await calculationModel.completeRun(run.id, assessmentId, {
      results: response.results ?? [],
      summary: {
        ...(response.summary ?? {}),
        skipped_modules: response.skipped_modules ?? [],
        engine_version: response.engine_version,
      },
      referenceSnapshot: referenceSnapshot(definitions),
      durationMs: response.duration_ms ?? null,
      engineVersion: response.engine_version ?? null,
    });

    return {
      run: completed,
      results: await calculationModel.listResults(run.id),
      skippedModules: response.skipped_modules ?? [],
    };
  } catch (err) {
    await calculationModel.failRun(run.id, `Could not store results: ${err.message}`);
    throw err;
  }
}

/**
 * The most recent run and its results, or null when the assessment has
 * never been calculated.
 */
async function latestResults(assessmentId) {
  const run = await calculationModel.latestRun(assessmentId);
  if (!run) return null;
  return { run, results: await calculationModel.listResults(run.id) };
}

module.exports = { calculateAssessment, latestResults };
