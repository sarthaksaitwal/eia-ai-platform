const asyncHandler = require("../utils/asyncHandler");
const referenceModel = require("../models/referenceModel");

const getCoefficients = asyncHandler(async (req, res) => {
  const { industry, factor } = req.query;
  const coefficients = await referenceModel.listCoefficients({ industry, factor });
  res.json({ coefficients });
});

const getRules = asyncHandler(async (req, res) => {
  const { factor } = req.query;
  const rules = await referenceModel.listRules({ factor });
  res.json({ rules });
});

// Regulatory comparison limits. unverified_count is reported so callers can see
// that some limits have not been checked against the notification text.
const getStandards = asyncHandler(async (req, res) => {
  const { category, parameter, zone, standard, verified } = req.query;
  const standards = await referenceModel.listStandards({
    category,
    parameterName: parameter,
    zone,
    standardName: standard,
    verifiedOnly: verified === "true",
  });
  res.json({ standards, unverified_count: standards.filter((row) => !row.verified).length });
});

module.exports = { getCoefficients, getRules, getStandards };
