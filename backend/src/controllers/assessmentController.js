const { validationResult } = require("express-validator");
const asyncHandler = require("../utils/asyncHandler");
const { ApiError } = require("../middleware/errorHandler");
const projectModel = require("../models/projectModel");
const assessmentModel = require("../models/assessmentModel");

const createAssessment = asyncHandler(async (req, res) => {
  const belongs = await projectModel.projectBelongsToUser(req.params.projectId, req.user.id);
  if (!belongs) throw new ApiError(404, "Project not found.");

  const assessment = await assessmentModel.createAssessment(req.params.projectId, {
    methodologyVersion: req.body.methodologyVersion,
  });
  res.status(201).json({ assessment });
});

const listAssessments = asyncHandler(async (req, res) => {
  const belongs = await projectModel.projectBelongsToUser(req.params.projectId, req.user.id);
  if (!belongs) throw new ApiError(404, "Project not found.");

  const assessments = await assessmentModel.listAssessmentsByProject(req.params.projectId);
  res.json({ assessments });
});

const getAssessment = asyncHandler(async (req, res) => {
  const owned = await assessmentModel.findAssessmentForUser(req.params.id, req.user.id);
  if (!owned) throw new ApiError(404, "Assessment not found.");

  const detail = await assessmentModel.getAssessmentDetail(req.params.id);
  res.json({ assessment: detail });
});

const addInputs = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new ApiError(400, errors.array()[0].msg);

  const owned = await assessmentModel.findAssessmentForUser(req.params.id, req.user.id);
  if (!owned) throw new ApiError(404, "Assessment not found.");

  const inputs = await assessmentModel.addAssessmentInputs(req.params.id, req.body.inputs);
  res.status(201).json({ inputs });
});

const listInputs = asyncHandler(async (req, res) => {
  const owned = await assessmentModel.findAssessmentForUser(req.params.id, req.user.id);
  if (!owned) throw new ApiError(404, "Assessment not found.");

  const inputs = await assessmentModel.listAssessmentInputs(req.params.id);
  res.json({ inputs });
});

module.exports = { createAssessment, listAssessments, getAssessment, addInputs, listInputs };
