-- ===============================================================
-- 003_regulatory_standards.sql
-- ===============================================================
--
-- Regulatory limits a measured or modelled value is compared against
-- (NAAQS concentrations, ambient noise limits, water/soil norms).
--
-- These are COMPARISON LIMITS. They are deliberately separate from:
--   engineering_coefficients  numbers used to CALCULATE a value
--   calculation_rules         how a value is calculated, and its score bands
--
-- parameter_name matches environmental_data.parameter_name / the analytics
-- service record keys (pm25, pm10, so2, no2, co, o3, nh3, leq_day, ...), so a
-- stored value can be joined to its limit.
--
-- Compare only when the units match. CPCB real-time values arrive as AQI
-- sub-indices, not concentrations, and cannot be compared with NAAQS limits.
--
-- Idempotent: migrate.js runs every migration file on each invocation.
-- ===============================================================

CREATE TABLE IF NOT EXISTS regulatory_standards (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    category            VARCHAR(50) NOT NULL,

    parameter_name      VARCHAR(100) NOT NULL,

    display_name        VARCHAR(200),

    standard_name       VARCHAR(200) NOT NULL,

    -- 'All' where one limit applies to every area.
    zone                VARCHAR(50) NOT NULL DEFAULT 'All',

    averaging_period    VARCHAR(50) NOT NULL,

    limit_type          VARCHAR(20) NOT NULL DEFAULT 'maximum',

    limit_value         NUMERIC(16,4) NOT NULL,

    unit                VARCHAR(50) NOT NULL,

    authority           VARCHAR(150) NOT NULL,

    reference           TEXT,

    effective_from      DATE,

    effective_to        DATE,

    -- FALSE until the value has been checked against the notification text.
    verified            BOOLEAN NOT NULL DEFAULT FALSE,

    active              BOOLEAN NOT NULL DEFAULT TRUE,

    notes               TEXT,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_regulatory_standards_category
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
        ),

    CONSTRAINT chk_regulatory_standards_limit_type
        CHECK (
            limit_type IN (
                'maximum',
                'minimum'
            )
        ),

    CONSTRAINT chk_regulatory_standards_limit_value
        CHECK (limit_value >= 0),

    CONSTRAINT uq_regulatory_standards
        UNIQUE (parameter_name, standard_name, zone, averaging_period)
);


CREATE INDEX IF NOT EXISTS idx_regulatory_standards_parameter
    ON regulatory_standards(parameter_name);

CREATE INDEX IF NOT EXISTS idx_regulatory_standards_category
    ON regulatory_standards(category);

CREATE INDEX IF NOT EXISTS idx_regulatory_standards_active
    ON regulatory_standards(active);


DROP TRIGGER IF EXISTS trg_regulatory_standards_updated_at ON regulatory_standards;

CREATE TRIGGER trg_regulatory_standards_updated_at
BEFORE UPDATE ON regulatory_standards
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


-- ===============================================================
-- SEED: INDIAN AMBIENT STANDARDS
-- ===============================================================
--
-- IMPORTANT: every seeded row has verified = FALSE.
--
-- The values below are the commonly published limits of the National
-- Ambient Air Quality Standards 2009 and the Noise Pollution
-- (Regulation and Control) Rules 2000. They have NOT been checked
-- against the gazette notifications by anyone on this project.
--
-- Before using this platform for a real assessment, check each row
-- against the notification named in `reference` and set verified = TRUE.
-- The application should treat verified = FALSE as "not fit for a
-- compliance statement".
-- ===============================================================

INSERT INTO regulatory_standards
(
    category,
    parameter_name,
    display_name,
    standard_name,
    zone,
    averaging_period,
    limit_type,
    limit_value,
    unit,
    authority,
    reference,
    notes
)
VALUES

-- ---------------------------
-- AIR: NAAQS 2009
-- ---------------------------

('Air', 'pm25', 'PM2.5', 'NAAQS 2009', 'All', 'Annual', 'maximum', 40, 'µg/m³',
 'CPCB / MoEFCC', 'National Ambient Air Quality Standards, G.S.R. 826(E), 16 November 2009', NULL),

('Air', 'pm25', 'PM2.5', 'NAAQS 2009', 'All', '24 hours', 'maximum', 60, 'µg/m³',
 'CPCB / MoEFCC', 'National Ambient Air Quality Standards, G.S.R. 826(E), 16 November 2009', NULL),

('Air', 'pm10', 'PM10', 'NAAQS 2009', 'All', 'Annual', 'maximum', 60, 'µg/m³',
 'CPCB / MoEFCC', 'National Ambient Air Quality Standards, G.S.R. 826(E), 16 November 2009', NULL),

('Air', 'pm10', 'PM10', 'NAAQS 2009', 'All', '24 hours', 'maximum', 100, 'µg/m³',
 'CPCB / MoEFCC', 'National Ambient Air Quality Standards, G.S.R. 826(E), 16 November 2009', NULL),

('Air', 'so2', 'SO2', 'NAAQS 2009', 'Industrial, Residential, Rural and Other', 'Annual', 'maximum', 50, 'µg/m³',
 'CPCB / MoEFCC', 'National Ambient Air Quality Standards, G.S.R. 826(E), 16 November 2009', NULL),

('Air', 'so2', 'SO2', 'NAAQS 2009', 'Industrial, Residential, Rural and Other', '24 hours', 'maximum', 80, 'µg/m³',
 'CPCB / MoEFCC', 'National Ambient Air Quality Standards, G.S.R. 826(E), 16 November 2009', NULL),

('Air', 'so2', 'SO2', 'NAAQS 2009', 'Ecologically Sensitive Area', 'Annual', 'maximum', 20, 'µg/m³',
 'CPCB / MoEFCC', 'National Ambient Air Quality Standards, G.S.R. 826(E), 16 November 2009',
 'Applies to areas notified by the central government.'),

('Air', 'no2', 'NO2', 'NAAQS 2009', 'Industrial, Residential, Rural and Other', 'Annual', 'maximum', 40, 'µg/m³',
 'CPCB / MoEFCC', 'National Ambient Air Quality Standards, G.S.R. 826(E), 16 November 2009', NULL),

('Air', 'no2', 'NO2', 'NAAQS 2009', 'Industrial, Residential, Rural and Other', '24 hours', 'maximum', 80, 'µg/m³',
 'CPCB / MoEFCC', 'National Ambient Air Quality Standards, G.S.R. 826(E), 16 November 2009', NULL),

('Air', 'no2', 'NO2', 'NAAQS 2009', 'Ecologically Sensitive Area', 'Annual', 'maximum', 30, 'µg/m³',
 'CPCB / MoEFCC', 'National Ambient Air Quality Standards, G.S.R. 826(E), 16 November 2009',
 'Applies to areas notified by the central government.'),

('Air', 'co', 'CO', 'NAAQS 2009', 'All', '8 hours', 'maximum', 2, 'mg/m³',
 'CPCB / MoEFCC', 'National Ambient Air Quality Standards, G.S.R. 826(E), 16 November 2009',
 'Note the unit: mg/m³, not µg/m³.'),

('Air', 'co', 'CO', 'NAAQS 2009', 'All', '1 hour', 'maximum', 4, 'mg/m³',
 'CPCB / MoEFCC', 'National Ambient Air Quality Standards, G.S.R. 826(E), 16 November 2009',
 'Note the unit: mg/m³, not µg/m³.'),

('Air', 'o3', 'Ozone', 'NAAQS 2009', 'All', '8 hours', 'maximum', 100, 'µg/m³',
 'CPCB / MoEFCC', 'National Ambient Air Quality Standards, G.S.R. 826(E), 16 November 2009', NULL),

('Air', 'o3', 'Ozone', 'NAAQS 2009', 'All', '1 hour', 'maximum', 180, 'µg/m³',
 'CPCB / MoEFCC', 'National Ambient Air Quality Standards, G.S.R. 826(E), 16 November 2009', NULL),

('Air', 'nh3', 'Ammonia', 'NAAQS 2009', 'All', 'Annual', 'maximum', 100, 'µg/m³',
 'CPCB / MoEFCC', 'National Ambient Air Quality Standards, G.S.R. 826(E), 16 November 2009', NULL),

('Air', 'nh3', 'Ammonia', 'NAAQS 2009', 'All', '24 hours', 'maximum', 400, 'µg/m³',
 'CPCB / MoEFCC', 'National Ambient Air Quality Standards, G.S.R. 826(E), 16 November 2009', NULL),

('Air', 'lead', 'Lead', 'NAAQS 2009', 'All', 'Annual', 'maximum', 0.5, 'µg/m³',
 'CPCB / MoEFCC', 'National Ambient Air Quality Standards, G.S.R. 826(E), 16 November 2009',
 'No provider integrated yet; requires site sampling.'),

('Air', 'benzene', 'Benzene', 'NAAQS 2009', 'All', 'Annual', 'maximum', 5, 'µg/m³',
 'CPCB / MoEFCC', 'National Ambient Air Quality Standards, G.S.R. 826(E), 16 November 2009',
 'No provider integrated yet; requires site sampling.'),

('Air', 'benzo_a_pyrene', 'Benzo(a)Pyrene', 'NAAQS 2009', 'All', 'Annual', 'maximum', 1, 'ng/m³',
 'CPCB / MoEFCC', 'National Ambient Air Quality Standards, G.S.R. 826(E), 16 November 2009',
 'Particulate phase only. No provider integrated yet; requires site sampling.'),

('Air', 'arsenic', 'Arsenic', 'NAAQS 2009', 'All', 'Annual', 'maximum', 6, 'ng/m³',
 'CPCB / MoEFCC', 'National Ambient Air Quality Standards, G.S.R. 826(E), 16 November 2009',
 'No provider integrated yet; requires site sampling.'),

('Air', 'nickel', 'Nickel', 'NAAQS 2009', 'All', 'Annual', 'maximum', 20, 'ng/m³',
 'CPCB / MoEFCC', 'National Ambient Air Quality Standards, G.S.R. 826(E), 16 November 2009',
 'No provider integrated yet; requires site sampling.'),


-- ---------------------------
-- NOISE: Noise Pollution (Regulation and Control) Rules, 2000
-- ---------------------------

('Noise', 'leq_day', 'Leq Day', 'Ambient Noise Standards 2000', 'Industrial', 'Day (06:00-22:00)', 'maximum', 75, 'dB(A)',
 'CPCB / MoEFCC', 'Noise Pollution (Regulation and Control) Rules, 2000', NULL),

('Noise', 'leq_night', 'Leq Night', 'Ambient Noise Standards 2000', 'Industrial', 'Night (22:00-06:00)', 'maximum', 70, 'dB(A)',
 'CPCB / MoEFCC', 'Noise Pollution (Regulation and Control) Rules, 2000', NULL),

('Noise', 'leq_day', 'Leq Day', 'Ambient Noise Standards 2000', 'Commercial', 'Day (06:00-22:00)', 'maximum', 65, 'dB(A)',
 'CPCB / MoEFCC', 'Noise Pollution (Regulation and Control) Rules, 2000', NULL),

('Noise', 'leq_night', 'Leq Night', 'Ambient Noise Standards 2000', 'Commercial', 'Night (22:00-06:00)', 'maximum', 55, 'dB(A)',
 'CPCB / MoEFCC', 'Noise Pollution (Regulation and Control) Rules, 2000', NULL),

('Noise', 'leq_day', 'Leq Day', 'Ambient Noise Standards 2000', 'Residential', 'Day (06:00-22:00)', 'maximum', 55, 'dB(A)',
 'CPCB / MoEFCC', 'Noise Pollution (Regulation and Control) Rules, 2000', NULL),

('Noise', 'leq_night', 'Leq Night', 'Ambient Noise Standards 2000', 'Residential', 'Night (22:00-06:00)', 'maximum', 45, 'dB(A)',
 'CPCB / MoEFCC', 'Noise Pollution (Regulation and Control) Rules, 2000', NULL),

('Noise', 'leq_day', 'Leq Day', 'Ambient Noise Standards 2000', 'Silence Zone', 'Day (06:00-22:00)', 'maximum', 50, 'dB(A)',
 'CPCB / MoEFCC', 'Noise Pollution (Regulation and Control) Rules, 2000',
 'Areas within 100 m of hospitals, educational institutions and courts.'),

('Noise', 'leq_night', 'Leq Night', 'Ambient Noise Standards 2000', 'Silence Zone', 'Night (22:00-06:00)', 'maximum', 40, 'dB(A)',
 'CPCB / MoEFCC', 'Noise Pollution (Regulation and Control) Rules, 2000',
 'Areas within 100 m of hospitals, educational institutions and courts.')

ON CONFLICT ON CONSTRAINT uq_regulatory_standards DO NOTHING;


-- ===============================================================
-- END OF 003_regulatory_standards.sql
-- ===============================================================
