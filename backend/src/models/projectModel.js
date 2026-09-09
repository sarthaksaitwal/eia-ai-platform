const { pool, query } = require("../config/db");

// Creates a project + its parameters + its location in a single transaction.
async function createProjectWithDetails({ userId, project, parameters, location }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const projectResult = await client.query(
      `INSERT INTO projects (user_id, name, industry, capacity, capacity_unit, land_area_hectares)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, user_id, name, industry, capacity, capacity_unit, land_area_hectares, status, created_at`,
      [
        userId,
        project.name,
        project.industry,
        project.capacity ?? null,
        project.capacityUnit ?? null,
        project.landAreaHectares ?? null,
      ]
    );
    const newProject = projectResult.rows[0];

    let newParameters = null;
    if (parameters) {
      const paramResult = await client.query(
        `INSERT INTO project_parameters (
           project_id, water_requirement_m3_day, power_requirement_mw, fuel_type,
           operating_hours_per_day, employees, raw_material_consumption,
           waste_generation_t_year, emission_control_equipment, extra_parameters
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          newProject.id,
          parameters.waterRequirementM3Day ?? null,
          parameters.powerRequirementMw ?? null,
          parameters.fuelType ?? null,
          parameters.operatingHoursPerDay ?? null,
          parameters.employees ?? null,
          parameters.rawMaterialConsumption ? JSON.stringify(parameters.rawMaterialConsumption) : null,
          parameters.wasteGenerationTYear ?? null,
          parameters.emissionControlEquipment ?? null,
          parameters.extraParameters ? JSON.stringify(parameters.extraParameters) : null,
        ]
      );
      newParameters = paramResult.rows[0];
    }

    let newLocation = null;
    if (location) {
      const locResult = await client.query(
        `INSERT INTO locations (project_id, latitude, longitude, geom, address)
         VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($3, $2), 4326), $4)
         RETURNING id, project_id, latitude, longitude, address, created_at`,
        [newProject.id, location.latitude, location.longitude, location.address ?? null]
      );
      newLocation = locResult.rows[0];
    }

    await client.query("COMMIT");
    return { ...newProject, parameters: newParameters, location: newLocation };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function findProjectsByUser(userId) {
  const { rows } = await query(
    `SELECT p.*, l.latitude, l.longitude, l.address
     FROM projects p
     LEFT JOIN locations l ON l.project_id = p.id
     WHERE p.user_id = $1
     ORDER BY p.created_at DESC`,
    [userId]
  );
  return rows;
}

async function findProjectById(projectId, userId) {
  const { rows } = await query(
    `SELECT p.*,
            row_to_json(pp) AS parameters,
            json_build_object('latitude', l.latitude, 'longitude', l.longitude, 'address', l.address) AS location
     FROM projects p
     LEFT JOIN project_parameters pp ON pp.project_id = p.id
     LEFT JOIN locations l ON l.project_id = p.id
     WHERE p.id = $1 AND p.user_id = $2`,
    [projectId, userId]
  );
  return rows[0] || null;
}

async function updateProject(projectId, userId, fields) {
  const allowed = ["name", "industry", "capacity", "capacity_unit", "land_area_hectares", "status"];
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
     SET ${setClauses.join(", ")}, updated_at = now()
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

// Finds sensitive features (from a caller-supplied table) within a radius (metres) of a project's location.
// featureTable must be validated against an allow-list by the caller before use.
async function findNearbyFeatures(projectId, featureTable, radiusMeters) {
  const { rows } = await query(
    `SELECT f.name, ST_Distance(f.geom::geography, l.geom::geography) AS distance_meters
     FROM locations l
     JOIN ${featureTable} f
       ON ST_DWithin(f.geom::geography, l.geom::geography, $2)
     WHERE l.project_id = $1
     ORDER BY distance_meters ASC`,
    [projectId, radiusMeters]
  );
  return rows;
}

module.exports = {
  createProjectWithDetails,
  findProjectsByUser,
  findProjectById,
  updateProject,
  deleteProject,
  findNearbyFeatures,
};
