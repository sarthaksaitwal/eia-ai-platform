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

module.exports = { getCoefficients, getRules };
