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

// Shared by POST and PUT, which take the same body: one form component fills
// both, so a rule that held on create and not on edit would be a way to store
// something the create route had already rejected.
const projectBody = [
  body("project.name").trim().notEmpty().withMessage("Project name is required."),
  body("project.industry").trim().notEmpty().withMessage("Industry is required."),

  // These four mirror CHECK constraints on the projects table (migration
  // 001). Without them a negative headcount reached Postgres and came back as
  // a 500, which tells the person filling in the form nothing about which
  // field to fix. `values: "null"` because the form clears an optional number
  // by sending null, and that has to stay allowed.
  body("project.landArea")
    .optional({ values: "null" })
    .isFloat({ min: 0 })
    .withMessage("Project area cannot be negative."),
  body("project.estimatedInvestment")
    .optional({ values: "null" })
    .isFloat({ min: 0 })
    .withMessage("Estimated investment cannot be negative."),
  body("project.employees")
    .optional({ values: "null" })
    .isInt({ min: 0 })
    .withMessage("Expected employees must be a whole number and cannot be negative."),
  body("project.operatingHoursPerDay")
    .optional({ values: "null" })
    .isFloat({ min: 0, max: 24 })
    .withMessage("Operating hours must be between 0 and 24."),

  body("location.latitude")
    .optional({ values: "null" })
    .isFloat({ min: -90, max: 90 })
    .withMessage("Latitude must be between -90 and 90."),
  body("location.longitude")
    .optional({ values: "null" })
    .isFloat({ min: -180, max: 180 })
    .withMessage("Longitude must be between -180 and 180."),
  // Declared by the user: ambient noise limits depend on it (see regulatory_standards.zone).
  body("location.areaClassification")
    .optional({ values: "null" })
    .isIn(AREA_CLASSIFICATIONS)
    .withMessage(`areaClassification must be one of: ${AREA_CLASSIFICATIONS.join(", ")}`),
  body("location.ecologicallySensitive").optional({ values: "null" }).isBoolean(),
];

router.post("/", projectBody, createProject);

router.get("/", listProjects);
router.get("/:id", getProject);
router.put("/:id", projectBody, updateProject);
router.delete("/:id", deleteProject);

// Nested: /api/projects/:projectId/assessments
router.use("/:projectId/assessments", assessmentRoutes);

module.exports = router;
