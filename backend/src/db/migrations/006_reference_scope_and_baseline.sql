-- ===============================================================
-- 006_reference_scope_and_baseline.sql
-- ===============================================================
--
-- Two gaps found while seeding the collected reference data.
--
-- 1. regulatory_standards could not hold a standard whose limit is
--    per unit of production. Schedule VI Part-B of the Environment
--    (Protection) Rules, 1986 notifies a maximum waste water
--    generation per tonne of product, per industry:
--
--        Sugar     0.4 m3 per tonne of cane crushed
--        Dairy     3   m3 per kL of milk
--
--    These have no zone and no averaging period, so all twenty rows
--    collapsed onto one unique key. They need the industry they
--    apply to, and the production basis the limit is measured
--    against.
--
-- 2. The Solapur district baseline had nowhere to go.
--    environmental_data and gis_analysis_results both require an
--    assessment_id, but this is reference data about a region that
--    exists before any assessment is created. Hence
--    regional_baseline.
--
-- Idempotent: migrate.js runs every migration file on each invocation.
-- ===============================================================


-- ===============================================================
-- 1. REGULATORY STANDARDS: industry and production basis
-- ===============================================================

-- 'All' means the standard applies regardless of industry, matching
-- engineering_coefficients.industry and regulatory_standards.zone.
ALTER TABLE regulatory_standards
    ADD COLUMN IF NOT EXISTS industry VARCHAR(150) NOT NULL DEFAULT 'All';

-- What the limit is measured per, for a standard expressed per unit
-- of production rather than as a concentration: 'per tonne of cane
-- crushed', 'per kL of alcohol produced'. NULL for ambient and
-- discharge limits.
ALTER TABLE regulatory_standards
    ADD COLUMN IF NOT EXISTS basis VARCHAR(150);


-- Two industries can notify a different limit for the same
-- parameter, so industry belongs in the unique key. The constraint
-- keeps its name because seedReference.js upserts with
-- ON CONFLICT ON CONSTRAINT uq_regulatory_standards.
ALTER TABLE regulatory_standards
    DROP CONSTRAINT IF EXISTS uq_regulatory_standards;

ALTER TABLE regulatory_standards
    ADD CONSTRAINT uq_regulatory_standards
        UNIQUE (parameter_name, standard_name, industry, zone, averaging_period, limit_type);


CREATE INDEX IF NOT EXISTS idx_regulatory_standards_industry
    ON regulatory_standards(industry);


-- ===============================================================
-- 2. REGIONAL BASELINE
-- ===============================================================
--
-- Published baseline values for an administrative area: the
-- groundwater category of a taluka, a district's annual PM10
-- average, a river monitoring station's water quality index.
--
-- Not observations. Each row is a number somebody published, with
-- the document it came from, and it is reused by every assessment
-- in that area instead of being fetched per assessment.
-- ===============================================================

CREATE TABLE IF NOT EXISTS regional_baseline (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Impact factor this informs, so the engine can pull a factor's
    -- baseline in one query.
    module          VARCHAR(50) NOT NULL,

    -- What was measured, e.g. 'Stage of groundwater extraction'.
    item            VARCHAR(200) NOT NULL,

    -- The area or station the value belongs to, e.g. 'Malshiras
    -- taluka', 'Bhima river at Takli (station 28)'.
    scope           VARCHAR(200) NOT NULL,

    state           VARCHAR(100),
    district        VARCHAR(100),

    value_numeric   NUMERIC(20,6),
    value_text      TEXT,
    unit            VARCHAR(50),

    -- Season splits, station codes, trend, and anything else printed
    -- beside the value.
    qualifier       TEXT,

    source          VARCHAR(200),
    reference       TEXT,

    -- Assessment year as the source prints it: '2023', '2022-23'.
    as_of           VARCHAR(50),

    -- COLLECTED        read from the cited document
    -- SECONDARY        read from a reproduction or third-party analysis
    -- NOT_COLLECTED    a known gap, kept so it stays visible
    status          VARCHAR(30) NOT NULL DEFAULT 'COLLECTED',

    -- TRUE for an index or sub-index (water quality index, AQI
    -- sub-index). An index must never be compared with a regulatory
    -- limit, so the engine has to be able to see which rows these are.
    is_index        BOOLEAN NOT NULL DEFAULT FALSE,

    verified        BOOLEAN NOT NULL DEFAULT FALSE,
    verified_by     VARCHAR(150),
    verified_on     DATE,

    notes           TEXT,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_regional_baseline_module
        CHECK (
            module IN (
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

    CONSTRAINT chk_regional_baseline_status
        CHECK (status IN ('COLLECTED', 'SECONDARY', 'NOT_COLLECTED')),

    -- A gap carries no number; anything else must carry a value.
    CONSTRAINT chk_regional_baseline_value
        CHECK (
            status = 'NOT_COLLECTED'
            OR value_numeric IS NOT NULL
            OR value_text IS NOT NULL
        ),

    CONSTRAINT chk_regional_baseline_verified
        CHECK (
            NOT verified
            OR (verified_by IS NOT NULL AND verified_on IS NOT NULL)
        )
);


-- The natural key. Declared here rather than inside CREATE TABLE so that
-- IF NOT EXISTS above cannot leave an older database with an older version
-- of it.
--
-- NULLS NOT DISTINCT matters. A NOT_COLLECTED row records a gap, so it has
-- no as_of. Under the default NULLS DISTINCT, Postgres treats two such rows
-- as different keys, ON CONFLICT never matches, and every run of
-- seed:reference inserts the gap rows again. Requires PostgreSQL 15 or newer.
ALTER TABLE regional_baseline
    DROP CONSTRAINT IF EXISTS uq_regional_baseline;

ALTER TABLE regional_baseline
    ADD CONSTRAINT uq_regional_baseline
        UNIQUE NULLS NOT DISTINCT (module, item, scope, as_of);


CREATE INDEX IF NOT EXISTS idx_regional_baseline_district
    ON regional_baseline(district);

CREATE INDEX IF NOT EXISTS idx_regional_baseline_module
    ON regional_baseline(module);

CREATE INDEX IF NOT EXISTS idx_regional_baseline_status
    ON regional_baseline(status);


-- ===============================================================
-- END OF 006_reference_scope_and_baseline.sql
-- ===============================================================
