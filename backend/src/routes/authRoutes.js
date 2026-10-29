const { Router } = require("express");
const { body } = require("express-validator");
const {
  register,
  login,
  me,
  updateMe,
  changePassword,
} = require("../controllers/authController");
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

// The settings screen. Email is not editable here: it is the sign-in
// identity and carries a unique constraint, so changing it needs a
// confirmation step this project does not have.
router.patch(
  "/me",
  requireAuth,
  [
    body("name").optional().trim().notEmpty().withMessage("Name cannot be empty."),
    body("organization").optional().trim(),
    body("role")
      .optional()
      .isIn(ALLOWED_ROLES)
      .withMessage(`Role must be one of: ${ALLOWED_ROLES.join(", ")}`),
  ],
  updateMe
);

router.put(
  "/me/password",
  requireAuth,
  [
    body("currentPassword").notEmpty().withMessage("Your current password is required."),
    body("newPassword")
      .isLength({ min: 8 })
      .withMessage("The new password must be at least 8 characters."),
  ],
  changePassword
);

module.exports = router;
