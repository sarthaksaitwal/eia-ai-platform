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

const router = Router();

router.use(requireAuth);

router.post(
  "/",
  [
    body("project.name").trim().notEmpty().withMessage("Project name is required."),
    body("project.industry").trim().notEmpty().withMessage("Industry is required."),
    body("location.latitude").optional().isFloat({ min: -90, max: 90 }),
    body("location.longitude").optional().isFloat({ min: -180, max: 180 }),
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
