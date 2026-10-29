const bcrypt = require("bcrypt");
const { validationResult } = require("express-validator");
const asyncHandler = require("../utils/asyncHandler");
const { ApiError } = require("../middleware/errorHandler");
const { signToken } = require("../utils/jwt");
const {
  createUser,
  findUserByEmail,
  findUserById,
  findPasswordHashById,
  updateUser,
  updatePassword,
} = require("../models/userModel");

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

const updateMe = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new ApiError(400, errors.array()[0].msg);

  const current = await findUserById(req.user.id);
  if (!current) throw new ApiError(404, "User not found.");

  const { name, organization, role } = req.body;

  // A field left out of the body keeps what is stored. Organization is the
  // only one that can legitimately be emptied, so a blank string clears it
  // rather than saving "" and showing an empty line under the name.
  const user = await updateUser(req.user.id, {
    name: name === undefined ? current.name : name,
    organization:
      organization === undefined ? current.organization : organization || null,
    role: role === undefined ? current.role : role,
  });

  // The email in the token is never read back for authorisation -- requireAuth
  // puts only the id and email on the request and nothing checks the role --
  // so a changed role needs no new token.
  res.json({ user });
});

const changePassword = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new ApiError(400, errors.array()[0].msg);

  const { currentPassword, newPassword } = req.body;

  const hash = await findPasswordHashById(req.user.id);
  if (!hash) throw new ApiError(404, "User not found.");

  const matches = await bcrypt.compare(currentPassword, hash);
  // 400, not 401: the session is perfectly good, one field in the form is
  // wrong. A 401 would have the frontend report an expired session and send
  // them back to sign in, losing the form.
  if (!matches) throw new ApiError(400, "Your current password is not correct.");

  const unchanged = await bcrypt.compare(newPassword, hash);
  if (unchanged) throw new ApiError(400, "The new password matches the current one.");

  await updatePassword(req.user.id, await bcrypt.hash(newPassword, SALT_ROUNDS));

  // The token issued before the change stays valid. These are stateless JWTs
  // with no revocation list, so a password change cannot sign other devices
  // out, and the UI must not claim it does.
  res.json({ ok: true });
});

module.exports = { register, login, me, updateMe, changePassword };
