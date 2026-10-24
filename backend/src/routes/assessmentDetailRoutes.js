const { Router } = require("express");
const { body, param } = require("express-validator");
const { requireAuth } = require("../middleware/auth");
const { getAssessment, addInputs, listInputs } = require("../controllers/assessmentController");
const { fetchEnvironmentalData, getEnvironmentalData } = require("../controllers/environmentalDataController");
const {
  getValues, saveValues, runCalculation, getResults, getRuns,
} = require("../controllers/calculationController");
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

// --------------------------------------------------- module calculations

// The values the user enters against the module parameters. Replaces
// /:id/inputs, which wrote to assessment_inputs and could not be resolved
// to anything the engine computes.
router.get("/:id/values", [assessmentIdParam], getValues);

router.post(
  "/:id/values",
  [
    assessmentIdParam,
    body("values").isArray({ min: 1 }).withMessage("values must be a non-empty array."),
    body("values.*.parameterCode").trim().notEmpty()
      .withMessage("parameterCode is required for every value."),
    body("values.*.valueNumeric")
      .optional({ values: "null" })
      .isFloat()
      .withMessage("valueNumeric must be a number.")
      .toFloat(),
    // Deliberately no non-negative check here. Most quantities cannot be
    // negative, but a measured value that is would be a data-quality
    // problem to surface rather than a request to reject at the edge, and
    // the module that owns the parameter is the right place to judge it.
    body("values.*.sourceStatus")
      .optional()
      .isIn([
        "OFFICIAL_LIVE", "OFFICIAL_REFERENCE", "USER_REPORTED",
        "USER_DOCUMENTED", "LAB_MEASURED", "GIS_DERIVED", "ESTIMATED",
        "STALE", "UNAVAILABLE", "UNVERIFIED",
      ])
      .withMessage("sourceStatus is not one of the recognised values."),
  ],
  saveValues
);

// Runs every output of every enabled module and stores the results.
router.post("/:id/calculate", [assessmentIdParam], runCalculation);

// The most recent run and its results.
router.get("/:id/results", [assessmentIdParam], getResults);

router.get("/:id/runs", [assessmentIdParam], getRuns);

module.exports = router;
