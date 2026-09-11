const { Router } = require("express");
const { requireAuth } = require("../middleware/auth");
const { getCoefficients, getRules, getStandards } = require("../controllers/referenceController");

const router = Router();

router.use(requireAuth);

router.get("/coefficients", getCoefficients);
router.get("/rules", getRules);
// ?category=Noise&parameter=leq_day&zone=Industrial&standard=...&verified=true
router.get("/standards", getStandards);

module.exports = router;
