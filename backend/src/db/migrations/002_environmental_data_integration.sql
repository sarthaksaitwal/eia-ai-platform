-- ===============================================================
-- 002_environmental_data_integration.sql
-- ===============================================================
--
-- Prepares the schema for storing the analytics service response
-- (FastAPI POST /api/environmental/fetch). The backend persists it in
-- src/models/environmentalDataModel.js.
--
-- Idempotent: migrate.js runs every migration file on each invocation.
-- ===============================================================


-- ===============================================================
-- 1. TIMESTAMP -> TIMESTAMPTZ
-- ===============================================================
--
-- TIMESTAMP stores wall-clock time without an offset. The analytics
-- service returns UTC times while CURRENT_TIMESTAMP defaults are written
-- in the server TimeZone (e.g. Asia/Calcutta), so plain TIMESTAMP values
-- from the two cannot be compared correctly. TIMESTAMPTZ stores an
-- absolute instant.
--
-- Existing values are read in the session TimeZone, which is the zone
-- CURRENT_TIMESTAMP wrote them in.
-- ===============================================================

DO $$
DECLARE
    col RECORD;
BEGIN
    FOR col IN
        SELECT c.table_name, c.column_name
        FROM information_schema.columns c
        JOIN information_schema.tables t
            ON t.table_schema = c.table_schema
           AND t.table_name = c.table_name
        WHERE c.table_schema = 'public'
          AND t.table_type = 'BASE TABLE'
          AND c.data_type = 'timestamp without time zone'
    LOOP
        EXECUTE format(
            'ALTER TABLE %I ALTER COLUMN %I TYPE TIMESTAMPTZ USING %I AT TIME ZONE current_setting(''TimeZone'')',
            col.table_name,
            col.column_name,
            col.column_name
        );
    END LOOP;
END $$;


-- ===============================================================
-- 2. ENVIRONMENTAL DATA / ASSESSMENT INPUT CATEGORIES
-- ===============================================================
--
-- The seven impact factors plus the supporting baseline categories
-- used by the environmental data specification. Impact factors
-- (impact_results, calculation_rules, ...) are unchanged.
-- ===============================================================

ALTER TABLE environmental_data
    DROP CONSTRAINT IF EXISTS chk_environmental_data_category;

ALTER TABLE environmental_data
    ADD CONSTRAINT chk_environmental_data_category
        CHECK (
            category IN (
                'Air',
                'Water',
                'Ecology',
                'Carbon',
                'Resource',
                'Waste',
                'Noise',
                'Meteorology',
                'Land',
                'Soil',
                'Socio-economic',
                'Natural Hazards'
            )
        );


ALTER TABLE assessment_inputs
    DROP CONSTRAINT IF EXISTS chk_assessment_inputs_category;

ALTER TABLE assessment_inputs
    ADD CONSTRAINT chk_assessment_inputs_category
        CHECK (
            category IN (
                'Air',
                'Water',
                'Ecology',
                'Carbon',
                'Resource',
                'Waste',
                'Noise',
                'Meteorology',
                'Land',
                'Soil',
                'Socio-economic',
                'Natural Hazards'
            )
        );


-- ===============================================================
-- 3. DATA SOURCES: STABLE KEY
-- ===============================================================
--
-- The analytics service identifies each provider by a source_key
-- (e.g. 'openaq', 'cpcb_ogd'). Names are for display and may change.
-- ===============================================================

ALTER TABLE data_sources
    ADD COLUMN IF NOT EXISTS source_key VARCHAR(100);

CREATE UNIQUE INDEX IF NOT EXISTS uq_data_sources_source_key
    ON data_sources(source_key);


-- ===============================================================
-- 4. DATA FETCH LOGS: RECORD COUNT
-- ===============================================================

ALTER TABLE data_fetch_logs
    ADD COLUMN IF NOT EXISTS record_count INTEGER;


-- ===============================================================
-- END OF 002_environmental_data_integration.sql
-- ===============================================================
