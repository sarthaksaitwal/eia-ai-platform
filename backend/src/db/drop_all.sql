-- ===============================================================
-- drop_all.sql
-- ===============================================================
--
-- DESTROYS EVERY TABLE AND EVERY ROW IN THE DATABASE.
--
-- This file is deliberately NOT in src/db/migrations/. migrate.js
-- reads that directory and applies whatever it finds, so a file
-- containing these statements must never live there.
--
-- The only thing that runs this is:
--
--     npm run migrate:reset -- --yes
--
-- Drop order is child-before-parent so the CASCADEs have nothing
-- left to do. regulatory_standards and regional_baseline are
-- created by later migrations but belong here too, otherwise a
-- reset would leave them behind holding stale reference data.
-- ===============================================================

DROP TABLE IF EXISTS data_fetch_logs CASCADE;
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS recommendations CASCADE;
DROP TABLE IF EXISTS impact_results CASCADE;
DROP TABLE IF EXISTS calculation_engine_runs CASCADE;
DROP TABLE IF EXISTS calculation_rule_coefficients CASCADE;
DROP TABLE IF EXISTS engineering_coefficients CASCADE;
DROP TABLE IF EXISTS calculation_rules CASCADE;
DROP TABLE IF EXISTS gis_analysis_results CASCADE;
DROP TABLE IF EXISTS environmental_data CASCADE;
DROP TABLE IF EXISTS assessment_inputs CASCADE;
DROP TABLE IF EXISTS assessments CASCADE;
DROP TABLE IF EXISTS project_documents CASCADE;
DROP TABLE IF EXISTS project_locations CASCADE;
DROP TABLE IF EXISTS regional_baseline CASCADE;
DROP TABLE IF EXISTS regulatory_standards CASCADE;
DROP TABLE IF EXISTS data_sources CASCADE;
DROP TABLE IF EXISTS project_parameters CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- The ledger goes last: if a drop above fails, the ledger still
-- describes what is actually in the database.
DROP TABLE IF EXISTS schema_migrations CASCADE;

-- ===============================================================
-- END OF drop_all.sql
-- ===============================================================
