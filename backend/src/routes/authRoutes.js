const { Router } = require("express");
const { body } = require("express-validator");
const { register, login, me } = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");
const { ALLOWED_ROLES } = require("../models/userModel");

const router = Router();

router.post(
  "/register",
  [
    body("name").trim().notEmpty().withMessage("Name is required."),
    body("email").isEmail().withMessage("A valid email is required."),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters."),
    body("role")
      .optional()
      .isIn(ALLOWED_ROLES)
      .withMessage(`Role must be one of: ${ALLOWED_ROLES.join(", ")}`),
    body("organization").optional().trim(),
  ],
  register
);

router.post(
  "/login",
  [
    body("email").isEmail().withMessage("A valid email is required."),
    body("password").notEmpty().withMessage("Password is required."),
  ],
  login
);

router.get("/me", requireAuth, me);

module.exports = router;
