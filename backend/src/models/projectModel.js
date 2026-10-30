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

// Updates the project and, when a location is supplied, that too -- in one
// transaction, so a half-applied edit cannot leave the site pointing at one
// place and the project describing another.
//
// Takes the same camelCase shape as createProjectWithLocation rather than the
// column names it used to take: one request body for both routes means the
// create and edit forms can be the same component.
//
// The location is an upsert. project_locations.project_id is UNIQUE, and a
// project created before the site was mandatory may have no row at all, so
// ON CONFLICT covers both cases. geom is recomputed by
// trg_project_location_geom, which fires on UPDATE OF latitude, longitude as
// well as on insert; nothing here has to maintain it.
async function updateProjectWithLocation(projectId, userId, { project, location }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Ownership is checked by the UPDATE's own WHERE clause rather than by a
    // prior SELECT: one statement cannot be raced the way a check-then-write
    // can, and a row count of zero is the 404.
    const projectResult = await client.query(
      `UPDATE projects
          SET name                    = COALESCE($3, name),
              industry                = COALESCE($4, industry),
              project_type            = $5,
              description             = $6,
              land_area               = $7,
              land_area_unit          = $8,
              estimated_investment    = $9,
              employees               = $10,
              operating_hours_per_day = $11,
              updated_at              = CURRENT_TIMESTAMP
        WHERE id = $1 AND user_id = $2
        RETURNING id`,
      [
        projectId,
        userId,
        // COALESCE on these two: they are NOT NULL in the schema, so an
        // omitted field has to leave the stored value alone. The nullable
        // columns below are assigned outright, because clearing one is a
        // legitimate edit and ?? null would make it impossible.
        project?.name ?? null,
        project?.industry ?? null,
        project?.projectType ?? null,
        project?.description ?? null,
        project?.landArea ?? null,
        project?.landAreaUnit ?? null,
        project?.estimatedInvestment ?? null,
        project?.employees ?? null,
        project?.operatingHoursPerDay ?? null,
      ]
    );

    if (projectResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    if (location) {
      await client.query(
        `INSERT INTO project_locations (
           project_id, address, city, district, state, country,
           latitude, longitude, elevation_m, area_classification,
           ecologically_sensitive
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (project_id) DO UPDATE
            SET address                = EXCLUDED.address,
                city                   = EXCLUDED.city,
                district               = EXCLUDED.district,
                state                  = EXCLUDED.state,
                country                = EXCLUDED.country,
                latitude               = EXCLUDED.latitude,
                longitude              = EXCLUDED.longitude,
                elevation_m            = EXCLUDED.elevation_m,
                area_classification    = EXCLUDED.area_classification,
                ecologically_sensitive = EXCLUDED.ecologically_sensitive`,
        [
          projectId,
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
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  // Read back through findProjectById so the response carries the nested
  // location, matching what GET /:id returns. An edit form that reloads from
  // this reply then sees exactly what it would see on a fresh visit.
  return findProjectById(projectId, userId);
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
  updateProjectWithLocation,
  deleteProject,
};
