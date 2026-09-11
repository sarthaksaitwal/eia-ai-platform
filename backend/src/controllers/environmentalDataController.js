const { validationResult } = require("express-validator");
const asyncHandler = require("../utils/asyncHandler");
const { ApiError } = require("../middleware/errorHandler");
const assessmentModel = require("../models/assessmentModel");
const environmentalDataModel = require("../models/environmentalDataModel");
const environmentalDataService = require("../services/environmentalDataService");

// Fetches environmental baseline data for the assessment's site via the
// analytics service and stores it. Takes 1-4 minutes.
const fetchEnvironmentalData = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new ApiError(400, errors.array()[0].msg);

  const owned = await assessmentModel.findAssessmentForUser(req.params.id, req.user.id);
  if (!owned) throw new ApiError(404, "Assessment not found.");

  const result = await environmentalDataService.fetchAndStoreEnvironmentalData({
    assessmentId: req.params.id,
    radiusKm: req.body.radiusKm,
  });
  res.status(201).json(result);
});

const getEnvironmentalData = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new ApiError(400, errors.array()[0].msg);

  const owned = await assessmentModel.findAssessmentForUser(req.params.id, req.user.id);
  if (!owned) throw new ApiError(404, "Assessment not found.");

  const { observations, gisResults, fetchLogs } = await environmentalDataModel.listEnvironmentalData(req.params.id);
  res.json({ environmental_data: observations, gis_results: gisResults, fetch_logs: fetchLogs });
});

module.exports = { fetchEnvironmentalData, getEnvironmentalData };
