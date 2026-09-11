const { pool, query } = require("../config/db");

const REQUEST_TYPE = "environmental_data";

// Project and site details the analytics service needs for one assessment.
async function getAssessmentContext(assessmentId) {
  const { rows } = await query(
    `SELECT a.id AS assessment_id,
            p.id AS project_id, p.name, p.industry, p.project_type,
            p.capacity, p.capacity_unit, p.land_area, p.land_area_unit,
            p.employees, p.operating_hours_per_day,
            l.id AS location_id, l.address, l.city, l.district, l.state, l.country,
            l.latitude, l.longitude, l.area_classification, l.ecologically_sensitive
     FROM assessments a
     JOIN projects p ON p.id = a.project_id
     LEFT JOIN project_locations l ON l.project_id = p.id
     WHERE a.id = $1`,
    [assessmentId]
  );
  return rows[0] || null;
}

// Stores one analytics service response in a single transaction.
//
// Rows from the providers in this fetch replace the assessment's earlier rows
// from the same providers, so a provider that fails this time leaves no stale
// values behind. Fetch logs are appended as an audit trail.
//
// Row arrays are built by services/environmentalDataService.js and inserted with
// jsonb_to_recordset, so each table is written with one statement.
async function saveFetchResult({ assessmentId, locationId, retrievedAt, dataSources, observations, gisResults, fetchLogs }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO data_sources (source_key, name, provider, source_type, endpoint)
       SELECT r.source_key, r.name, r.provider, r.source_type, r.endpoint
       FROM jsonb_to_recordset($1::jsonb)
         AS r(source_key text, name text, provider text, source_type text, endpoint text)
       ON CONFLICT (source_key) DO UPDATE
         SET name = EXCLUDED.name,
             provider = EXCLUDED.provider,
             source_type = EXCLUDED.source_type,
             endpoint = EXCLUDED.endpoint,
             active = TRUE`,
      [JSON.stringify(dataSources)]
    );
    const sourceKeys = dataSources.map((source) => source.source_key);

    await client.query(
      `DELETE FROM environmental_data ed
       USING data_sources ds
       WHERE ed.source_id = ds.id
         AND ed.assessment_id = $1
         AND ds.source_key = ANY($2::text[])`,
      [assessmentId, sourceKeys]
    );
    await client.query(
      `DELETE FROM gis_analysis_results
       WHERE assessment_id = $1 AND metadata->>'source_key' = ANY($2::text[])`,
      [assessmentId, sourceKeys]
    );

    const observationResult = await client.query(
      `INSERT INTO environmental_data (
         assessment_id, location_id, source_id, category, parameter_name,
         value_numeric, value_text, unit, recorded_at, retrieved_at, metadata
       )
       SELECT $1::uuid, $2::uuid, ds.id, r.category, r.parameter_name,
              r.value_numeric, r.value_text, r.unit, r.recorded_at, $3::timestamptz, r.metadata
       FROM jsonb_to_recordset($4::jsonb)
         AS r(source_key text, category text, parameter_name text, value_numeric numeric,
              value_text text, unit text, recorded_at timestamptz, metadata jsonb)
       JOIN data_sources ds ON ds.source_key = r.source_key`,
      [assessmentId, locationId, retrievedAt, JSON.stringify(observations)]
    );
    if (observationResult.rowCount !== observations.length) {
      throw new Error("Analytics response contains observations from a provider it did not report.");
    }

    const gisResult = await client.query(
      `INSERT INTO gis_analysis_results (
         assessment_id, location_id, feature_type, feature_name, distance_m, inside_boundary,
         sensitivity_level, value_numeric, value_text, unit, source, source_reference, metadata, analyzed_at
       )
       SELECT $1::uuid, $2::uuid, r.feature_type, r.feature_name, r.distance_m, r.inside_boundary,
              r.sensitivity_level, r.value_numeric, r.value_text, r.unit, r.source, r.source_reference,
              r.metadata, $3::timestamptz
       FROM jsonb_to_recordset($4::jsonb)
         AS r(feature_type text, feature_name text, distance_m numeric, inside_boundary boolean,
              sensitivity_level text, value_numeric numeric, value_text text, unit text,
              source text, source_reference text, metadata jsonb)`,
      [assessmentId, locationId, retrievedAt, JSON.stringify(gisResults)]
    );

    const logResult = await client.query(
      `INSERT INTO data_fetch_logs (
         assessment_id, source_id, request_type, request_parameters, status,
         response_time_ms, record_count, error_message, fetched_at
       )
       SELECT $1::uuid, ds.id, $2::text, r.request_parameters, r.status,
              r.response_time_ms, r.record_count, r.error_message, $3::timestamptz
       FROM jsonb_to_recordset($4::jsonb)
         AS r(source_key text, request_parameters jsonb, status text, response_time_ms integer,
              record_count integer, error_message text)
       JOIN data_sources ds ON ds.source_key = r.source_key`,
      [assessmentId, REQUEST_TYPE, retrievedAt, JSON.stringify(fetchLogs)]
    );

    await client.query("COMMIT");
    return {
      observations: observationResult.rowCount,
      gisResults: gisResult.rowCount,
      fetchLogs: logResult.rowCount,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function listEnvironmentalData(assessmentId) {
  const [observations, gisResults, fetchLogs] = await Promise.all([
    query(
      `SELECT ed.*, ds.source_key, ds.name AS source_name
       FROM environmental_data ed
       LEFT JOIN data_sources ds ON ds.id = ed.source_id
       WHERE ed.assessment_id = $1
       ORDER BY ed.category, ed.parameter_name`,
      [assessmentId]
    ).then((r) => r.rows),
    query(
      `SELECT * FROM gis_analysis_results
       WHERE assessment_id = $1
       ORDER BY feature_type, distance_m NULLS LAST`,
      [assessmentId]
    ).then((r) => r.rows),
    // Provider outcomes of the latest fetch: every log row of one fetch shares fetched_at.
    query(
      `SELECT fl.id, ds.source_key, ds.name AS source_name, ds.provider,
              fl.status, fl.record_count, fl.response_time_ms, fl.error_message,
              fl.request_parameters, fl.fetched_at
       FROM data_fetch_logs fl
       JOIN data_sources ds ON ds.id = fl.source_id
       WHERE fl.assessment_id = $1
         AND fl.request_type = $2
         AND fl.fetched_at = (
           SELECT MAX(fetched_at) FROM data_fetch_logs
           WHERE assessment_id = $1 AND request_type = $2
         )
       ORDER BY ds.source_key`,
      [assessmentId, REQUEST_TYPE]
    ).then((r) => r.rows),
  ]);

  return { observations, gisResults, fetchLogs };
}

module.exports = { getAssessmentContext, saveFetchResult, listEnvironmentalData };
