const { Router } = require("express");
const { createAssessment, listAssessments } = require("../controllers/assessmentController");

// mergeParams so this sub-router can read :projectId from the parent route.
const router = Router({ mergeParams: true });

router.post("/", createAssessment);
router.get("/", listAssessments);

module.exports = router;
