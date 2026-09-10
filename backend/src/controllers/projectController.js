const { validationResult } = require("express-validator");
const asyncHandler = require("../utils/asyncHandler");
const { ApiError } = require("../middleware/errorHandler");
const projectModel = require("../models/projectModel");

const createProject = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new ApiError(400, errors.array()[0].msg);

  const { project, location } = req.body;

  const created = await projectModel.createProjectWithLocation({
    userId: req.user.id,
    project,
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

module.exports = { createProject, listProjects, getProject, updateProject, deleteProject };
