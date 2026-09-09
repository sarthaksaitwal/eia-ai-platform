const { validationResult } = require("express-validator");
const asyncHandler = require("../utils/asyncHandler");
const { ApiError } = require("../middleware/errorHandler");
const projectModel = require("../models/projectModel");

const createProject = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new ApiError(400, errors.array()[0].msg);

  const { project, parameters, location } = req.body;

  const created = await projectModel.createProjectWithDetails({
    userId: req.user.id,
    project,
    parameters,
    location,
  });

  res.status(201).json({ project: created });
});

const listProjects = asyncHandler(async (req, res) => {
  const projects = await projectModel.findProjectsByUser(req.user.id);
  res.json({ projects });
});

const getProject = asyncHandler(async (req, res) => {
  const project = await projectModel.findProjectById(req.params.id, req.user.id);
  if (!project) throw new ApiError(404, "Project not found.");
  res.json({ project });
});

const updateProject = asyncHandler(async (req, res) => {
  const updated = await projectModel.updateProject(req.params.id, req.user.id, req.body);
  if (!updated) throw new ApiError(404, "Project not found.");
  res.json({ project: updated });
});

const deleteProject = asyncHandler(async (req, res) => {
  const deleted = await projectModel.deleteProject(req.params.id, req.user.id);
  if (!deleted) throw new ApiError(404, "Project not found.");
  res.status(204).send();
});

// Example GIS endpoint: nearby rivers within a radius. Table name is allow-listed here,
// not taken from user input, to prevent SQL injection via identifiers.
const ALLOWED_FEATURE_TABLES = {
  rivers: "rivers",
  settlements: "settlements",
  forests: "forests",
  protected_areas: "protected_areas",
};

const getNearbyFeatures = asyncHandler(async (req, res) => {
  const { feature } = req.params;
  const radius = Number(req.query.radius) || 5000;

  const tableName = ALLOWED_FEATURE_TABLES[feature];
  if (!tableName) throw new ApiError(400, `Unsupported feature type: ${feature}`);

  // Ensure the project belongs to the requesting user before running the spatial query.
  const project = await projectModel.findProjectById(req.params.id, req.user.id);
  if (!project) throw new ApiError(404, "Project not found.");

  const results = await projectModel.findNearbyFeatures(req.params.id, tableName, radius);
  res.json({ feature, radius_meters: radius, results });
});

module.exports = {
  createProject,
  listProjects,
  getProject,
  updateProject,
  deleteProject,
  getNearbyFeatures,
};
