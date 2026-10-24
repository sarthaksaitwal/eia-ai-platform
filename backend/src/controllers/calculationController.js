const { validationResult } = require("express-validator");
const asyncHandler = require("../utils/asyncHandler");
const { ApiError } = require("../middleware/errorHandler");
const assessmentModel = require("../models/assessmentModel");
const calculationModel = require("../models/calculationModel");
const moduleModel = require("../models/moduleModel");
const calculationService = require("../services/calculationService");

// ------------------------------------------------------------ the registry

// What the platform asks and what it produces, read from the module tables.
// The input form is generated from this, so a module added by seeding
// appears in the UI without a frontend change.
const getModules = asyncHandler(async (req, res) => {
  const [modules, parameters, outputs] = await Promise.all([
    moduleModel.listModules(),
    moduleModel.listParameters(),
    moduleModel.listOutputs(),
  ]);

  const enabled = new Set(modules.map((m) => m.code));

  res.json({
    modules: modules.map((module) => ({
      ...module,
      parameters: parameters.filter((p) => p.module_code === module.code),
      outputs: outputs.filter((o) => o.module_code === module.code),
    })),
    // Outputs whose module is disabled are listed apart rather than hidden,
    // so the UI can say what is coming and why it is not available.
    unavailable_outputs: outputs.filter((o) => !enabled.has(o.module_code)),
  });
});

// The seeded constants and limits, with their citations. This is the
// reference data a report has to be able to show.
const getReferenceData = asyncHandler(async (req, res) => {
  const [constants, limits] = await Promise.all([
    moduleModel.listConstants(),
    moduleModel.listLimits(),
  ]);
  res.json({
    constants,
    limits,
    unverified_constants: constants.filter((c) => !c.verified).length,
    unverified_limits: limits.filter((l) => !l.verified).length,
  });
});

// ------------------------------------------------------- values and runs

async function ownedAssessment(req) {
  const owned = await assessmentModel.findAssessmentForUser(req.params.id, req.user.id);
  if (!owned) throw new ApiError(404, "Assessment not found.");
  return owned;
}

const getValues = asyncHandler(async (req, res) => {
  await ownedAssessment(req);
  const values = await moduleModel.listParameterValues(req.params.id);
  res.json({ values });
});

const saveValues = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new ApiError(400, errors.array()[0].msg);

  await ownedAssessment(req);

  // A value with neither a number nor text is only accepted when the user
  // has said the figure is unavailable. That is a real answer and is
  // stored; an empty submission with no such claim is a mistake.
  for (const value of req.body.values) {
    const blank = value.valueNumeric === undefined || value.valueNumeric === null;
    const noText = !value.valueText;
    if (blank && noText && value.sourceStatus !== "UNAVAILABLE") {
      throw new ApiError(
        400,
        `"${value.parameterCode}" has no value. Enter one, or mark it `
        + "UNAVAILABLE to record that the figure cannot be supplied."
      );
    }
  }

  const saved = await moduleModel.saveParameterValues(
    req.params.id, req.body.values, req.user.id
  );
  res.status(201).json({ values: saved });
});

const runCalculation = asyncHandler(async (req, res) => {
  await ownedAssessment(req);

  const outcome = await calculationService.calculateAssessment(req.params.id, {
    triggeredBy: req.user.id,
  });

  res.status(201).json(outcome);
});

const getResults = asyncHandler(async (req, res) => {
  await ownedAssessment(req);

  const latest = await calculationService.latestResults(req.params.id);
  if (!latest) {
    // Not an error: an assessment that has never been calculated is a
    // normal state, and the UI needs to tell them so rather than show a
    // failure.
    return res.json({ run: null, results: [], calculated: false });
  }

  res.json({ ...latest, calculated: true });
});

const getRuns = asyncHandler(async (req, res) => {
  await ownedAssessment(req);
  const runs = await calculationModel.listRuns(req.params.id);
  res.json({ runs });
});

module.exports = {
  getModules,
  getReferenceData,
  getValues,
  saveValues,
  runCalculation,
  getResults,
  getRuns,
};
