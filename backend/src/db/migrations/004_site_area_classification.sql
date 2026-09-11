-- ===============================================================
-- 004_site_area_classification.sql
-- ===============================================================
--
-- How the site is classified for regulatory comparison.
--
-- Ambient noise limits differ by area class (Noise Pollution Rules
-- 2000), and the NAAQS SO2/NO2 limits are stricter in a notified
-- ecologically sensitive area. Neither can be derived from a
-- coordinate: OpenStreetMap land use is a hint, not a notification.
-- The project developer or consultant declares them.
--
-- Idempotent: migrate.js runs every migration file on each invocation.
-- ===============================================================

ALTER TABLE project_locations
    ADD COLUMN IF NOT EXISTS area_classification VARCHAR(50);

ALTER TABLE project_locations
    ADD COLUMN IF NOT EXISTS ecologically_sensitive BOOLEAN;

ALTER TABLE project_locations
    DROP CONSTRAINT IF EXISTS chk_project_locations_area_classification;

ALTER TABLE project_locations
    ADD CONSTRAINT chk_project_locations_area_classification
        CHECK (
            area_classification IS NULL
            OR area_classification IN (
                'Industrial',
                'Commercial',
                'Residential',
                'Silence Zone',
                'Rural/Other'
            )
        );


COMMENT ON COLUMN project_locations.area_classification IS
    'Area class for ambient noise limits; matches regulatory_standards.zone.';

COMMENT ON COLUMN project_locations.ecologically_sensitive IS
    'TRUE if the site is in an area notified as ecologically sensitive (stricter NAAQS SO2/NO2 limits).';


-- ===============================================================
-- END OF 004_site_area_classification.sql
-- ===============================================================
