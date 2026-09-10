const bcrypt = require("bcrypt");
const { validationResult } = require("express-validator");
const asyncHandler = require("../utils/asyncHandler");
const { ApiError } = require("../middleware/errorHandler");
const { signToken } = require("../utils/jwt");
const { createUser, findUserByEmail, findUserById } = require("../models/userModel");

const SALT_ROUNDS = 12;

const register = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new ApiError(400, errors.array()[0].msg);

  const { name, email, password, role, organization } = req.body;

  const existing = await findUserByEmail(email);
  if (existing) throw new ApiError(409, "An account with this email already exists.");

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await createUser({
    name,
    email,
    passwordHash,
    role: role || "PROJECT_DEVELOPER",
    organization,
  });

  const token = signToken({ sub: user.id, email: user.email, role: user.role });
  res.status(201).json({ user, token });
});

const login = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new ApiError(400, errors.array()[0].msg);

  const { email, password } = req.body;
  const user = await findUserByEmail(email);
  if (!user) throw new ApiError(401, "Invalid email or password.");
  if (!user.is_active) throw new ApiError(403, "This account has been deactivated.");

  const passwordMatches = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatches) throw new ApiError(401, "Invalid email or password.");

  const token = signToken({ sub: user.id, email: user.email, role: user.role });
  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      organization: user.organization,
      created_at: user.created_at,
    },
    token,
  });
});

const me = asyncHandler(async (req, res) => {
  const user = await findUserById(req.user.id);
  if (!user) throw new ApiError(404, "User not found.");
  res.json({ user });
});

module.exports = { register, login, me };
