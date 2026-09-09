// Custom error class so controllers can throw errors with a specific HTTP status.
class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function notFoundHandler(req, res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;

  // Postgres unique-violation -> 409 Conflict
  if (err.code === "23505") {
    return res.status(409).json({ error: "A record with these details already exists." });
  }

  if (process.env.NODE_ENV !== "production") {
    console.error(err);
  }

  res.status(statusCode).json({
    error: statusCode === 500 ? "Internal server error." : err.message,
  });
}

module.exports = { ApiError, notFoundHandler, errorHandler };
