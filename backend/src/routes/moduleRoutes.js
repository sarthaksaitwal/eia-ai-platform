const { Router } = require("express");
const { requireAuth } = require("../middleware/auth");
const { getModules, getReferenceData } = require("../controllers/calculationController");

const router = Router();

router.use(requireAuth);

// The module registry: what each module asks for and what it produces. The
// input form is generated from this, so a module added by seeding needs no
// frontend change to appear.
router.get("/", getModules);

// The seeded constants and limits with their citations, and how many of
// them a person has not yet checked against the source document.
router.get("/reference", getReferenceData);

module.exports = router;
