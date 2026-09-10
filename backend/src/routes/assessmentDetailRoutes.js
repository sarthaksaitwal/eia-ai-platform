const { Router } = require("express");
const { body } = require("express-validator");
const { requireAuth } = require("../middleware/auth");
const { getAssessment, addInputs, listInputs } = require("../controllers/assessmentController");
const { VALID_CATEGORIES } = require("../models/assessmentModel");

const router = Router();

router.use(requireAuth);

router.get("/:id", getAssessment);

router.post(
  "/:id/inputs",
  [
    body("inputs").isArray({ min: 1 }).withMessage("inputs must be a non-empty array."),
    body("inputs.*.category")
      .isIn(VALID_CATEGORIES)
      .withMessage(`category must be one of: ${VALID_CATEGORIES.join(", ")}`),
    body("inputs.*.parameterName").trim().notEmpty().withMessage("parameterName is required."),
  ],
  addInputs
);

router.get("/:id/inputs", listInputs);

module.exports = router;
