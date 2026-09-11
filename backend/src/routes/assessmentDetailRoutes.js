const { Router } = require("express");
const { body, param } = require("express-validator");
const { requireAuth } = require("../middleware/auth");
const { getAssessment, addInputs, listInputs } = require("../controllers/assessmentController");
const { fetchEnvironmentalData, getEnvironmentalData } = require("../controllers/environmentalDataController");
const { VALID_CATEGORIES } = require("../models/assessmentModel");

const assessmentIdParam = param("id").isUUID().withMessage("Assessment id must be a UUID.");

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

// Sends the site location, project and inputs to the analytics service and stores the result.
router.post(
  "/:id/environmental-data",
  [
    assessmentIdParam,
    body("radiusKm")
      .optional({ values: "null" })
      .isFloat({ gt: 0, max: 25 })
      .withMessage("radiusKm must be greater than 0 and at most 25.")
      .toFloat(),
  ],
  fetchEnvironmentalData
);

router.get("/:id/environmental-data", [assessmentIdParam], getEnvironmentalData);

module.exports = router;
