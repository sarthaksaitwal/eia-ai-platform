const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const authRoutes = require("./routes/authRoutes");
const projectRoutes = require("./routes/projectRoutes");
const assessmentDetailRoutes = require("./routes/assessmentDetailRoutes");
const referenceRoutes = require("./routes/referenceRoutes");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "*" }));
app.use(express.json());
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);       // includes nested /:projectId/assessments (create, list)
app.use("/api/assessments", assessmentDetailRoutes); // /:id detail, /:id/inputs, /:id/environmental-data
app.use("/api/reference", referenceRoutes);    // engineering coefficients + calculation rules

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
