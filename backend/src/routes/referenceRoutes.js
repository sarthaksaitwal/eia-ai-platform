const { Router } = require("express");
const { requireAuth } = require("../middleware/auth");
const { getCoefficients, getRules } = require("../controllers/referenceController");

const router = Router();

router.use(requireAuth);

router.get("/coefficients", getCoefficients);
router.get("/rules", getRules);

module.exports = router;
