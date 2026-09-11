const { Router } = require("express");
const { body } = require("express-validator");
const { requireAuth } = require("../middleware/auth");
const {
  createProject,
  listProjects,
  getProject,
  updateProject,
  deleteProject,
} = require("../controllers/projectController");
const assessmentRoutes = require("./assessmentRoutes");

// Must match chk_project_locations_area_classification (migration 004).
const AREA_CLASSIFICATIONS = ["Industrial", "Commercial", "Residential", "Silence Zone", "Rural/Other"];

const router = Router();

router.use(requireAuth);

router.post(
  "/",
  [
    body("project.name").trim().notEmpty().withMessage("Project name is required."),
    body("project.industry").trim().notEmpty().withMessage("Industry is required."),
    body("location.latitude").optional().isFloat({ min: -90, max: 90 }),
    body("location.longitude").optional().isFloat({ min: -180, max: 180 }),
    // Declared by the user: ambient noise limits depend on it (see regulatory_standards.zone).
    body("location.areaClassification")
      .optional()
      .isIn(AREA_CLASSIFICATIONS)
      .withMessage(`areaClassification must be one of: ${AREA_CLASSIFICATIONS.join(", ")}`),
    body("location.ecologicallySensitive").optional().isBoolean(),
  ],
  createProject
);

router.get("/", listProjects);
router.get("/:id", getProject);
router.put("/:id", updateProject);
router.delete("/:id", deleteProject);

// Nested: /api/projects/:projectId/assessments
router.use("/:projectId/assessments", assessmentRoutes);

module.exports = router;
