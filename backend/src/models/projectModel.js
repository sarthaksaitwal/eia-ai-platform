const { pool, query } = require("../config/db");

// Creates a project and (optionally) its location in a single transaction.
// Note: technical/environmental parameters no longer live on the project.
// They belong to a specific assessment (see assessmentModel), since a
// project can have multiple assessments over time.
async function createProjectWithLocation({ userId, project, location }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const projectResult = await client.query(
      `INSERT INTO projects (
         user_id, name, project_type, industry, description, developer_name,
         capacity, capacity_unit, land_area, land_area_unit,
         estimated_investment, employees, operating_hours_per_day
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        userId,
        project.name,
        project.projectType ?? null,
        project.industry,
        project.description ?? null,
        project.developerName ?? null,
        project.capacity ?? null,
        project.capacityUnit ?? null,
        project.landArea ?? null,
        project.landAreaUnit ?? null,
        project.estimatedInvestment ?? null,
        project.employees ?? null,
        project.operatingHoursPerDay ?? null,
      ]
    );
    const newProject = projectResult.rows[0];

    let newLocation = null;
    if (location) {
      // geom is populated automatically by the trg_project_location_geom trigger.
      const locResult = await client.query(
        `INSERT INTO project_locations (
           project_id, address, city, district, state, country,
           latitude, longitude, elevation_m, area_classification, ecologically_sensitive
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id, project_id, address, city, district, state, country,
                   latitude, longitude, elevation_m, area_classification,
                   ecologically_sensitive, created_at`,
        [
          newProject.id,
          location.address ?? null,
          location.city ?? null,
          location.district ?? null,
          location.state ?? null,
          location.country ?? null,
          location.latitude ?? null,
          location.longitude ?? null,
          location.elevationM ?? null,
          location.areaClassification ?? null,
          location.ecologicallySensitive ?? null,
        ]
      );
      newLocation = locResult.rows[0];
    }

    await client.query("COMMIT");
    return { ...newProject, location: newLocation };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function findProjectsByUser(userId) {
  const { rows } = await query(
    `SELECT p.*,
            l.address, l.city, l.district, l.state, l.country,
            l.latitude, l.longitude
     FROM projects p
     LEFT JOIN project_locations l ON l.project_id = p.id
     WHERE p.user_id = $1
     ORDER BY p.created_at DESC`,
    [userId]
  );
  return rows;
}

async function findProjectById(projectId, userId) {
  const { rows } = await query(
    `SELECT p.*,
            row_to_json(l) AS location
     FROM projects p
     LEFT JOIN project_locations l ON l.project_id = p.id
     WHERE p.id = $1 AND p.user_id = $2`,
    [projectId, userId]
  );
  return rows[0] || null;
}

// Confirms a project belongs to a user without pulling the full row - used by
// nested resources (assessments) to authorize access cheaply.
async function projectBelongsToUser(projectId, userId) {
  const { rows } = await query(
    `SELECT 1 FROM projects WHERE id = $1 AND user_id = $2`,
    [projectId, userId]
  );
  return rows.length > 0;
}

async function updateProject(projectId, userId, fields) {
  const allowed = [
    "name", "project_type", "industry", "description", "developer_name",
    "capacity", "capacity_unit", "land_area", "land_area_unit",
    "estimated_investment", "employees", "operating_hours_per_day", "status",
  ];
  const setClauses = [];
  const values = [];
  let idx = 1;

  for (const [key, value] of Object.entries(fields)) {
    if (allowed.includes(key)) {
      setClauses.push(`${key} = $${idx}`);
      values.push(value);
      idx += 1;
    }
  }

  if (setClauses.length === 0) return findProjectById(projectId, userId);

  values.push(projectId, userId);
  const { rows } = await query(
    `UPDATE projects
     SET ${setClauses.join(", ")}, updated_at = CURRENT_TIMESTAMP
     WHERE id = $${idx} AND user_id = $${idx + 1}
     RETURNING *`,
    values
  );
  return rows[0] || null;
}

async function deleteProject(projectId, userId) {
  const { rowCount } = await query(
    `DELETE FROM projects WHERE id = $1 AND user_id = $2`,
    [projectId, userId]
  );
  return rowCount > 0;
}

module.exports = {
  createProjectWithLocation,
  findProjectsByUser,
  findProjectById,
  projectBelongsToUser,
  updateProject,
  deleteProject,
};
