-- ===============================================================
-- 1. EXTENSIONS
-- ===============================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ===============================================================
-- 2. DROP EXISTING TABLES
-- ===============================================================
--
-- Safe for the current development database because the database
-- currently contains no important data.
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
DROP TABLE IF EXISTS data_sources CASCADE;
DROP TABLE IF EXISTS project_parameters CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS users CASCADE;


-- ===============================================================
-- 3. USERS
-- ===============================================================

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    name            VARCHAR(150) NOT NULL,

    email           VARCHAR(255) NOT NULL UNIQUE,

    password_hash   VARCHAR(255) NOT NULL,

    role            VARCHAR(50) NOT NULL,

    organization    VARCHAR(200),

    is_active       BOOLEAN NOT NULL DEFAULT TRUE,

    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_users_role
        CHECK (
            role IN (
                'PROJECT_DEVELOPER',
                'ENVIRONMENTAL_CONSULTANT',
                'SUSTAINABILITY_OFFICER',
                'ADMIN'
            )
        )
);


-- ===============================================================
-- 4. PROJECTS
-- ===============================================================

CREATE TABLE projects (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    user_id                 UUID NOT NULL,

    name                    VARCHAR(200) NOT NULL,

    project_type            VARCHAR(100),

    industry                VARCHAR(150) NOT NULL,

    description             TEXT,

    developer_name          VARCHAR(200),

    capacity                NUMERIC(14,2),

    capacity_unit           VARCHAR(50),

    land_area               NUMERIC(14,2),

    land_area_unit          VARCHAR(30),

    estimated_investment    NUMERIC(16,2),

    employees               INTEGER,

    operating_hours_per_day NUMERIC(5,2),

    status                  VARCHAR(30) NOT NULL DEFAULT 'Draft',

    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_projects_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT chk_projects_status
        CHECK (
            status IN (
                'Draft',
                'In Progress',
                'Completed',
                'Archived'
            )
        ),

    CONSTRAINT chk_projects_operating_hours
        CHECK (
            operating_hours_per_day IS NULL
            OR (
                operating_hours_per_day >= 0
                AND operating_hours_per_day <= 24
            )
        ),

    CONSTRAINT chk_projects_capacity
        CHECK (
            capacity IS NULL OR capacity >= 0
        ),

    CONSTRAINT chk_projects_land_area
        CHECK (
            land_area IS NULL OR land_area >= 0
        ),

    CONSTRAINT chk_projects_employees
        CHECK (
            employees IS NULL OR employees >= 0
        )
);


CREATE INDEX idx_projects_user_id
    ON projects(user_id);


-- ===============================================================
-- 5. PROJECT LOCATIONS
-- ===============================================================

CREATE TABLE project_locations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    project_id      UUID NOT NULL UNIQUE,

    address         TEXT,

    city            VARCHAR(100),

    district        VARCHAR(100),

    state           VARCHAR(100),

    country         VARCHAR(100),

    latitude        DOUBLE PRECISION,

    longitude       DOUBLE PRECISION,

    geom            GEOMETRY(Point, 4326),

    elevation_m     NUMERIC(10,2),

    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_project_locations_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT chk_project_locations_latitude
        CHECK (
            latitude IS NULL
            OR latitude BETWEEN -90 AND 90
        ),

    CONSTRAINT chk_project_locations_longitude
        CHECK (
            longitude IS NULL
            OR longitude BETWEEN -180 AND 180
        )
);


CREATE INDEX idx_project_locations_geom
    ON project_locations
    USING GIST (geom);


-- ===============================================================
-- 6. PROJECT DOCUMENTS
-- ===============================================================

CREATE TABLE project_documents (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    project_id      UUID NOT NULL,

    document_type   VARCHAR(100) NOT NULL,

    file_name       VARCHAR(255) NOT NULL,

    file_path       VARCHAR(500) NOT NULL,

    uploaded_by     UUID,

    uploaded_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_project_documents_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_project_documents_user
        FOREIGN KEY (uploaded_by)
        REFERENCES users(id)
        ON DELETE SET NULL
);


CREATE INDEX idx_project_documents_project_id
    ON project_documents(project_id);


-- ===============================================================
-- 7. ASSESSMENTS
-- ===============================================================
--
-- One project can have multiple assessments.
-- ===============================================================

CREATE TABLE assessments (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    project_id          UUID NOT NULL,

    assessment_number   INTEGER NOT NULL,

    status              VARCHAR(30) NOT NULL DEFAULT 'Draft',

    methodology_version VARCHAR(50),

    overall_score       NUMERIC(5,2),

    risk_level          VARCHAR(30),

    started_at          TIMESTAMP,

    completed_at        TIMESTAMP,

    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_assessments_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT uq_assessments_project_number
        UNIQUE (project_id, assessment_number),

    CONSTRAINT chk_assessments_status
        CHECK (
            status IN (
                'Draft',
                'Pending',
                'Processing',
                'Completed',
                'Failed'
            )
        ),

    CONSTRAINT chk_assessments_risk_level
        CHECK (
            risk_level IS NULL
            OR risk_level IN (
                'Low',
                'Moderate',
                'High'
            )
        ),

    CONSTRAINT chk_assessments_score
        CHECK (
            overall_score IS NULL
            OR overall_score BETWEEN 0 AND 100
        )
);


CREATE INDEX idx_assessments_project_id
    ON assessments(project_id);


-- ===============================================================
-- 8. ASSESSMENT INPUTS
-- ===============================================================

CREATE TABLE assessment_inputs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    assessment_id   UUID NOT NULL,

    category        VARCHAR(50) NOT NULL,

    parameter_name  VARCHAR(100) NOT NULL,

    value_numeric   NUMERIC(16,4),

    value_text      TEXT,

    unit            VARCHAR(50),

    source          VARCHAR(50),

    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_assessment_inputs_assessment
        FOREIGN KEY (assessment_id)
        REFERENCES assessments(id)
        ON DELETE CASCADE,

    CONSTRAINT chk_assessment_inputs_category
        CHECK (
            category IN (
                'Air',
                'Water',
                'Ecology',
                'Carbon',
                'Resource',
                'Waste',
                'Noise'
            )
        )
);


CREATE INDEX idx_assessment_inputs_assessment_id
    ON assessment_inputs(assessment_id);


-- ===============================================================
-- 9. DATA SOURCES
-- ===============================================================

CREATE TABLE data_sources (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    name            VARCHAR(150) NOT NULL,

    provider        VARCHAR(150),

    source_type     VARCHAR(50),

    endpoint        TEXT,

    description     TEXT,

    active          BOOLEAN NOT NULL DEFAULT TRUE,

    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ===============================================================
-- 10. ENVIRONMENTAL DATA
-- ===============================================================

CREATE TABLE environmental_data (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    assessment_id   UUID NOT NULL,

    location_id     UUID,

    source_id       UUID,

    category        VARCHAR(50) NOT NULL,

    parameter_name  VARCHAR(100) NOT NULL,

    value_numeric   NUMERIC(16,4),

    value_text      TEXT,

    unit            VARCHAR(50),

    recorded_at     TIMESTAMP,

    retrieved_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    metadata        JSONB,

    CONSTRAINT fk_environmental_data_assessment
        FOREIGN KEY (assessment_id)
        REFERENCES assessments(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_environmental_data_location
        FOREIGN KEY (location_id)
        REFERENCES project_locations(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_environmental_data_source
        FOREIGN KEY (source_id)
        REFERENCES data_sources(id)
        ON DELETE SET NULL,

    CONSTRAINT chk_environmental_data_category
        CHECK (
            category IN (
                'Air',
                'Water',
                'Ecology',
                'Carbon',
                'Resource',
                'Waste',
                'Noise'
            )
        )
);


CREATE INDEX idx_environmental_data_assessment_id
    ON environmental_data(assessment_id);

CREATE INDEX idx_environmental_data_location_id
    ON environmental_data(location_id);

CREATE INDEX idx_environmental_data_source_id
    ON environmental_data(source_id);

CREATE INDEX idx_environmental_data_category
    ON environmental_data(category);


-- ===============================================================
-- 11. GIS ANALYSIS RESULTS
-- ===============================================================
--
-- Stores values derived by the GIS service for a specific assessment.
-- Examples:
--   distance to protected area
--   distance to river/lake
--   distance to forest
--   distance to settlement
--   ecological sensitivity
--
-- GIS-derived values are kept separate from user-entered
-- assessment_inputs and externally fetched environmental_data.
-- ===============================================================

CREATE TABLE gis_analysis_results (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    assessment_id       UUID NOT NULL,

    location_id         UUID,

    feature_type        VARCHAR(100) NOT NULL,

    feature_name        VARCHAR(200),

    distance_m          NUMERIC(14,2),

    inside_boundary     BOOLEAN,

    sensitivity_level   VARCHAR(30),

    value_numeric       NUMERIC(16,4),

    value_text          TEXT,

    unit                VARCHAR(50),

    source              VARCHAR(200),

    source_reference    TEXT,

    metadata            JSONB,

    analyzed_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_gis_analysis_results_assessment
        FOREIGN KEY (assessment_id)
        REFERENCES assessments(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_gis_analysis_results_location
        FOREIGN KEY (location_id)
        REFERENCES project_locations(id)
        ON DELETE SET NULL,

    CONSTRAINT chk_gis_analysis_results_distance
        CHECK (
            distance_m IS NULL OR distance_m >= 0
        ),

    CONSTRAINT chk_gis_analysis_results_sensitivity
        CHECK (
            sensitivity_level IS NULL
            OR sensitivity_level IN (
                'Low',
                'Moderate',
                'High'
            )
        )
);


CREATE INDEX idx_gis_analysis_results_assessment_id
    ON gis_analysis_results(assessment_id);

CREATE INDEX idx_gis_analysis_results_location_id
    ON gis_analysis_results(location_id);

CREATE INDEX idx_gis_analysis_results_feature_type
    ON gis_analysis_results(feature_type);


-- ===============================================================
-- 12. ENGINEERING COEFFICIENTS
-- ===============================================================
--
-- Stores numerical engineering/environmental factors used by
-- calculation rules.
--
-- Examples:
--   Cement CO2 emission factor
--   Cement water consumption factor
--   Steel energy intensity
--   Textile wastewater factor
--
-- DO NOT treat the demo seed values at the bottom of this file
-- as authoritative environmental/regulatory values.
-- ===============================================================

CREATE TABLE engineering_coefficients (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    industry            VARCHAR(150),

    factor              VARCHAR(50) NOT NULL,

    coefficient_code    VARCHAR(100) NOT NULL UNIQUE,

    coefficient_name    VARCHAR(200) NOT NULL,

    value               NUMERIC(16,8) NOT NULL,

    unit                VARCHAR(100) NOT NULL,

    source              VARCHAR(200),

    reference           TEXT,

    methodology_version VARCHAR(50),

    conditions          JSONB,

    active              BOOLEAN NOT NULL DEFAULT TRUE,

    effective_from      TIMESTAMP,

    effective_to        TIMESTAMP,

    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_engineering_coefficient_factor
        CHECK (
            factor IN (
                'Air',
                'Water',
                'Ecology',
                'Carbon',
                'Resource',
                'Waste',
                'Noise'
            )
        ),

    CONSTRAINT chk_engineering_coefficient_value
        CHECK (value >= 0)
);


CREATE INDEX idx_engineering_coefficients_industry
    ON engineering_coefficients(industry);

CREATE INDEX idx_engineering_coefficients_factor
    ON engineering_coefficients(factor);

CREATE INDEX idx_engineering_coefficients_active
    ON engineering_coefficients(active);


-- ===============================================================
-- 13. CALCULATION RULES
-- ===============================================================
--
-- Defines HOW a calculation is performed.
--
-- Example:
--
--   rule_code: CEMENT_CO2
--   formula: activity * emission_factor
--
-- The numerical factor itself lives in engineering_coefficients.
-- ===============================================================

CREATE TABLE calculation_rules (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    factor              VARCHAR(50) NOT NULL,

    rule_code           VARCHAR(50) NOT NULL UNIQUE,

    rule_name           VARCHAR(200) NOT NULL,

    description         TEXT,

    formula             TEXT NOT NULL,

    conditions          JSONB,

    thresholds          JSONB,

    weight              NUMERIC(6,3),

    methodology_version VARCHAR(50),

    reference           TEXT,

    active              BOOLEAN NOT NULL DEFAULT TRUE,

    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_calculation_rules_factor
        CHECK (
            factor IN (
                'Air',
                'Water',
                'Ecology',
                'Carbon',
                'Resource',
                'Waste',
                'Noise'
            )
        ),

    CONSTRAINT chk_calculation_rules_weight
        CHECK (
            weight IS NULL
            OR weight >= 0
        )
);


CREATE INDEX idx_calculation_rules_factor
    ON calculation_rules(factor);

CREATE INDEX idx_calculation_rules_active
    ON calculation_rules(active);


-- ===============================================================
-- 14. CALCULATION RULE ↔ ENGINEERING COEFFICIENTS
-- ===============================================================
--
-- A rule can use multiple coefficients.
-- A coefficient can be reused by multiple rules.
--
-- Therefore this is a MANY-TO-MANY relationship.
-- ===============================================================

CREATE TABLE calculation_rule_coefficients (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    rule_id             UUID NOT NULL,

    coefficient_id      UUID NOT NULL,

    parameter_name      VARCHAR(100),

    coefficient_order   INTEGER NOT NULL DEFAULT 1,

    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_rule_coefficients_rule
        FOREIGN KEY (rule_id)
        REFERENCES calculation_rules(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_rule_coefficients_coefficient
        FOREIGN KEY (coefficient_id)
        REFERENCES engineering_coefficients(id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_rule_coefficient
        UNIQUE (rule_id, coefficient_id),

    CONSTRAINT chk_coefficient_order
        CHECK (coefficient_order > 0)
);


CREATE INDEX idx_rule_coefficients_rule_id
    ON calculation_rule_coefficients(rule_id);

CREATE INDEX idx_rule_coefficients_coefficient_id
    ON calculation_rule_coefficients(coefficient_id);


-- ===============================================================
-- 15. CALCULATION ENGINE RUNS
-- ===============================================================
--
-- Represents an execution of the calculation engine for one
-- assessment.
--
-- This table answers:
--
--   Which assessment was calculated?
--   Which engine version was used?
--   When did calculation start/end?
--   Did it succeed?
--   What inputs were used?
--   What outputs were produced?
--   Was there an error?
--
-- This is intentionally separate from impact_results.
--
-- calculation_engine_runs = EXECUTION / AUDIT RECORD
-- impact_results          = ACTUAL ENVIRONMENTAL RESULTS
-- ===============================================================

CREATE TABLE calculation_engine_runs (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    assessment_id       UUID NOT NULL,

    engine_version      VARCHAR(50) NOT NULL,

    methodology_version VARCHAR(50),

    status              VARCHAR(30) NOT NULL DEFAULT 'Pending',

    triggered_by        UUID,

    started_at          TIMESTAMP,

    completed_at        TIMESTAMP,

    execution_time_ms   INTEGER,

    input_snapshot      JSONB,

    output_summary      JSONB,

    error_message       TEXT,

    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_calculation_engine_runs_assessment
        FOREIGN KEY (assessment_id)
        REFERENCES assessments(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_calculation_engine_runs_user
        FOREIGN KEY (triggered_by)
        REFERENCES users(id)
        ON DELETE SET NULL,

    CONSTRAINT chk_calculation_engine_runs_status
        CHECK (
            status IN (
                'Pending',
                'Running',
                'Completed',
                'Failed'
            )
        ),

    CONSTRAINT chk_calculation_engine_runs_execution_time
        CHECK (
            execution_time_ms IS NULL
            OR execution_time_ms >= 0
        )
);


CREATE INDEX idx_calculation_engine_runs_assessment_id
    ON calculation_engine_runs(assessment_id);

CREATE INDEX idx_calculation_engine_runs_status
    ON calculation_engine_runs(status);


-- ===============================================================
-- 16. IMPACT RESULTS
-- ===============================================================
--
-- Stores the actual result produced after a calculation rule
-- is executed for an assessment.
-- ===============================================================

CREATE TABLE impact_results (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    assessment_id       UUID NOT NULL,

    rule_id             UUID NOT NULL,

    factor              VARCHAR(50) NOT NULL,

    score               NUMERIC(5,2),

    risk_level          VARCHAR(30),

    calculation_method  VARCHAR(100),

    rule_version        VARCHAR(50),

    input_summary       JSONB,

    calculation_details JSONB,

    key_findings        TEXT,

    explanation         TEXT,

    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_impact_results_assessment
        FOREIGN KEY (assessment_id)
        REFERENCES assessments(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_impact_results_rule
        FOREIGN KEY (rule_id)
        REFERENCES calculation_rules(id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_impact_results_factor
        CHECK (
            factor IN (
                'Air',
                'Water',
                'Ecology',
                'Carbon',
                'Resource',
                'Waste',
                'Noise'
            )
        ),

    CONSTRAINT chk_impact_results_score
        CHECK (
            score IS NULL
            OR score BETWEEN 0 AND 100
        ),

    CONSTRAINT chk_impact_results_risk
        CHECK (
            risk_level IS NULL
            OR risk_level IN (
                'Low',
                'Moderate',
                'High'
            )
        )
);


CREATE INDEX idx_impact_results_assessment_id
    ON impact_results(assessment_id);

CREATE INDEX idx_impact_results_rule_id
    ON impact_results(rule_id);

CREATE INDEX idx_impact_results_factor
    ON impact_results(factor);


-- ===============================================================
-- 17. RECOMMENDATIONS
-- ===============================================================

CREATE TABLE recommendations (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    assessment_id       UUID NOT NULL,

    impact_result_id    UUID,

    factor              VARCHAR(50) NOT NULL,

    priority            VARCHAR(30) NOT NULL,

    issue               TEXT NOT NULL,

    recommendation      TEXT NOT NULL,

    expected_benefit    TEXT,

    status              VARCHAR(30),

    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_recommendations_assessment
        FOREIGN KEY (assessment_id)
        REFERENCES assessments(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_recommendations_impact_result
        FOREIGN KEY (impact_result_id)
        REFERENCES impact_results(id)
        ON DELETE SET NULL,

    CONSTRAINT chk_recommendations_factor
        CHECK (
            factor IN (
                'Air',
                'Water',
                'Ecology',
                'Carbon',
                'Resource',
                'Waste',
                'Noise'
            )
        ),

    CONSTRAINT chk_recommendations_priority
        CHECK (
            priority IN (
                'High',
                'Medium',
                'Low'
            )
        )
);


CREATE INDEX idx_recommendations_assessment_id
    ON recommendations(assessment_id);

CREATE INDEX idx_recommendations_impact_result_id
    ON recommendations(impact_result_id);


-- ===============================================================
-- 18. REPORTS
-- ===============================================================

CREATE TABLE reports (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    assessment_id   UUID NOT NULL,

    report_type     VARCHAR(50) NOT NULL,

    file_name       VARCHAR(255) NOT NULL,

    file_path       VARCHAR(500) NOT NULL,

    status          VARCHAR(30),

    generated_by    UUID,

    generated_at    TIMESTAMP,

    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_reports_assessment
        FOREIGN KEY (assessment_id)
        REFERENCES assessments(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_reports_generated_by
        FOREIGN KEY (generated_by)
        REFERENCES users(id)
        ON DELETE SET NULL
);


CREATE INDEX idx_reports_assessment_id
    ON reports(assessment_id);

CREATE INDEX idx_reports_generated_by
    ON reports(generated_by);


-- ===============================================================
-- 19. DATA FETCH LOGS
-- ===============================================================
--
-- Optional but useful for external environmental API auditing.
-- ===============================================================

CREATE TABLE data_fetch_logs (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    assessment_id       UUID NOT NULL,

    source_id           UUID NOT NULL,

    request_type        VARCHAR(100),

    request_parameters  JSONB,

    status              VARCHAR(30),

    response_time_ms    INTEGER,

    error_message       TEXT,

    fetched_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_data_fetch_logs_assessment
        FOREIGN KEY (assessment_id)
        REFERENCES assessments(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_data_fetch_logs_source
        FOREIGN KEY (source_id)
        REFERENCES data_sources(id)
        ON DELETE CASCADE
);


CREATE INDEX idx_data_fetch_logs_assessment_id
    ON data_fetch_logs(assessment_id);

CREATE INDEX idx_data_fetch_logs_source_id
    ON data_fetch_logs(source_id);


-- ===============================================================
-- 19. POSTGIS GEOMETRY TRIGGER
-- ===============================================================

CREATE OR REPLACE FUNCTION set_project_location_geom()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.latitude IS NOT NULL
       AND NEW.longitude IS NOT NULL THEN

        NEW.geom :=
            ST_SetSRID(
                ST_MakePoint(
                    NEW.longitude,
                    NEW.latitude
                ),
                4326
            );

    ELSE
        NEW.geom := NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


CREATE TRIGGER trg_project_location_geom
BEFORE INSERT OR UPDATE OF latitude, longitude
ON project_locations
FOR EACH ROW
EXECUTE FUNCTION set_project_location_geom();


-- ===============================================================
-- 20. UPDATED_AT TRIGGER FUNCTION
-- ===============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


CREATE TRIGGER trg_projects_updated_at
BEFORE UPDATE ON projects
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


CREATE TRIGGER trg_assessments_updated_at
BEFORE UPDATE ON assessments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


CREATE TRIGGER trg_assessment_inputs_updated_at
BEFORE UPDATE ON assessment_inputs
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


CREATE TRIGGER trg_data_sources_updated_at
BEFORE UPDATE ON data_sources
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


CREATE TRIGGER trg_engineering_coefficients_updated_at
BEFORE UPDATE ON engineering_coefficients
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


CREATE TRIGGER trg_calculation_rules_updated_at
BEFORE UPDATE ON calculation_rules
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


CREATE TRIGGER trg_recommendations_updated_at
BEFORE UPDATE ON recommendations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


-- ===============================================================
-- 21. DEMO ENGINEERING COEFFICIENT DATA
-- ===============================================================
--
-- IMPORTANT:
-- These values are PLACEHOLDERS FOR DEVELOPMENT / DEMONSTRATION.
--
-- Before using the platform for a real environmental assessment,
-- replace them with validated coefficients from the chosen
-- authoritative methodology/source.
--
-- We intentionally keep the source/reference fields explicit so
-- every coefficient can later be audited.
-- ===============================================================

INSERT INTO engineering_coefficients
(
    industry,
    factor,
    coefficient_code,
    coefficient_name,
    value,
    unit,
    source,
    reference,
    methodology_version,
    conditions,
    active
)
VALUES

-- ---------------------------
-- CEMENT
-- ---------------------------

(
    'Cement',
    'Carbon',
    'DEMO_CEMENT_CO2_FACTOR',
    'Demonstration Cement CO2 Emission Factor',
    0.70000000,
    't CO2 / t product',
    'DEMO_MVP',
    'PLACEHOLDER - replace with validated source',
    'MVP-DEMO-1',
    '{"fuel_type":"generic","status":"demonstration"}',
    TRUE
),

(
    'Cement',
    'Water',
    'DEMO_CEMENT_WATER_FACTOR',
    'Demonstration Cement Water Consumption Factor',
    2.50000000,
    'm3 / t product',
    'DEMO_MVP',
    'PLACEHOLDER - replace with validated source',
    'MVP-DEMO-1',
    '{"process_type":"generic","status":"demonstration"}',
    TRUE
),

(
    'Cement',
    'Waste',
    'DEMO_CEMENT_WASTE_FACTOR',
    'Demonstration Cement Waste Generation Factor',
    0.02000000,
    't waste / t product',
    'DEMO_MVP',
    'PLACEHOLDER - replace with validated source',
    'MVP-DEMO-1',
    '{"waste_type":"generic","status":"demonstration"}',
    TRUE
),

(
    'Cement',
    'Air',
    'DEMO_CEMENT_PM10_FACTOR',
    'Demonstration Cement PM10 Emission Factor',
    0.00100000,
    't PM10 / t product',
    'DEMO_MVP',
    'PLACEHOLDER - replace with validated source',
    'MVP-DEMO-1',
    '{"pollutant":"PM10","status":"demonstration"}',
    TRUE
),


-- ---------------------------
-- STEEL
-- ---------------------------

(
    'Steel',
    'Carbon',
    'DEMO_STEEL_CO2_FACTOR',
    'Demonstration Steel CO2 Emission Factor',
    1.80000000,
    't CO2 / t product',
    'DEMO_MVP',
    'PLACEHOLDER - replace with validated source',
    'MVP-DEMO-1',
    '{"process_type":"generic","status":"demonstration"}',
    TRUE
),

(
    'Steel',
    'Water',
    'DEMO_STEEL_WATER_FACTOR',
    'Demonstration Steel Water Consumption Factor',
    5.00000000,
    'm3 / t product',
    'DEMO_MVP',
    'PLACEHOLDER - replace with validated source',
    'MVP-DEMO-1',
    '{"process_type":"generic","status":"demonstration"}',
    TRUE
),

(
    'Steel',
    'Waste',
    'DEMO_STEEL_WASTE_FACTOR',
    'Demonstration Steel Waste Generation Factor',
    0.10000000,
    't waste / t product',
    'DEMO_MVP',
    'PLACEHOLDER - replace with validated source',
    'MVP-DEMO-1',
    '{"waste_type":"generic","status":"demonstration"}',
    TRUE
),


-- ---------------------------
-- TEXTILE
-- ---------------------------

(
    'Textile',
    'Water',
    'DEMO_TEXTILE_WATER_FACTOR',
    'Demonstration Textile Water Consumption Factor',
    100.00000000,
    'm3 / t product',
    'DEMO_MVP',
    'PLACEHOLDER - replace with validated source',
    'MVP-DEMO-1',
    '{"process_type":"generic","status":"demonstration"}',
    TRUE
),

(
    'Textile',
    'Waste',
    'DEMO_TEXTILE_WASTE_FACTOR',
    'Demonstration Textile Waste Generation Factor',
    0.05000000,
    't waste / t product',
    'DEMO_MVP',
    'PLACEHOLDER - replace with validated source',
    'MVP-DEMO-1',
    '{"waste_type":"generic","status":"demonstration"}',
    TRUE
),


-- ---------------------------
-- PHARMACEUTICAL
-- ---------------------------

(
    'Pharmaceutical',
    'Water',
    'DEMO_PHARMA_WATER_FACTOR',
    'Demonstration Pharmaceutical Water Consumption Factor',
    50.00000000,
    'm3 / t product',
    'DEMO_MVP',
    'PLACEHOLDER - replace with validated source',
    'MVP-DEMO-1',
    '{"process_type":"generic","status":"demonstration"}',
    TRUE
),

(
    'Pharmaceutical',
    'Waste',
    'DEMO_PHARMA_WASTE_FACTOR',
    'Demonstration Pharmaceutical Waste Generation Factor',
    0.03000000,
    't waste / t product',
    'DEMO_MVP',
    'PLACEHOLDER - replace with validated source',
    'MVP-DEMO-1',
    '{"waste_type":"generic","status":"demonstration"}',
    TRUE
),


-- ---------------------------
-- CHEMICAL
-- ---------------------------

(
    'Chemical',
    'Water',
    'DEMO_CHEMICAL_WATER_FACTOR',
    'Demonstration Chemical Industry Water Consumption Factor',
    40.00000000,
    'm3 / t product',
    'DEMO_MVP',
    'PLACEHOLDER - replace with validated source',
    'MVP-DEMO-1',
    '{"process_type":"generic","status":"demonstration"}',
    TRUE
),

(
    'Chemical',
    'Waste',
    'DEMO_CHEMICAL_WASTE_FACTOR',
    'Demonstration Chemical Industry Waste Generation Factor',
    0.08000000,
    't waste / t product',
    'DEMO_MVP',
    'PLACEHOLDER - replace with validated source',
    'MVP-DEMO-1',
    '{"waste_type":"generic","status":"demonstration"}',
    TRUE
),


-- ---------------------------
-- PAPER
-- ---------------------------

(
    'Paper',
    'Water',
    'DEMO_PAPER_WATER_FACTOR',
    'Demonstration Paper Water Consumption Factor',
    30.00000000,
    'm3 / t product',
    'DEMO_MVP',
    'PLACEHOLDER - replace with validated source',
    'MVP-DEMO-1',
    '{"process_type":"generic","status":"demonstration"}',
    TRUE
),

(
    'Paper',
    'Waste',
    'DEMO_PAPER_WASTE_FACTOR',
    'Demonstration Paper Waste Generation Factor',
    0.04000000,
    't waste / t product',
    'DEMO_MVP',
    'PLACEHOLDER - replace with validated source',
    'MVP-DEMO-1',
    '{"waste_type":"generic","status":"demonstration"}',
    TRUE
);


-- ===============================================================
-- 22. DEMO CALCULATION RULES
-- ===============================================================
--
-- These are example rules for demonstrating the calculation
-- architecture.
-- ===============================================================

INSERT INTO calculation_rules
(
    factor,
    rule_code,
    rule_name,
    description,
    formula,
    conditions,
    thresholds,
    weight,
    methodology_version,
    reference,
    active
)
VALUES

(
    'Carbon',
    'DEMO_CARBON_BY_PRODUCTION',
    'Carbon Emission from Production',
    'Estimates carbon emissions from annual production using an industry-specific coefficient.',
    'annual_production * carbon_coefficient',
    '{"required_inputs":["annual_production"]}',
    '{"Low":30,"Moderate":60,"High":80}',
    1.000,
    'MVP-DEMO-1',
    'PLACEHOLDER - replace with validated methodology',
    TRUE
),

(
    'Water',
    'DEMO_WATER_BY_PRODUCTION',
    'Water Consumption from Production',
    'Estimates annual water consumption using an industry-specific water coefficient.',
    'annual_production * water_coefficient',
    '{"required_inputs":["annual_production"]}',
    '{"Low":30,"Moderate":60,"High":80}',
    1.000,
    'MVP-DEMO-1',
    'PLACEHOLDER - replace with validated methodology',
    TRUE
),

(
    'Waste',
    'DEMO_WASTE_BY_PRODUCTION',
    'Waste Generation from Production',
    'Estimates annual waste generation using an industry-specific waste coefficient.',
    'annual_production * waste_coefficient',
    '{"required_inputs":["annual_production"]}',
    '{"Low":30,"Moderate":60,"High":80}',
    1.000,
    'MVP-DEMO-1',
    'PLACEHOLDER - replace with validated methodology',
    TRUE
),

(
    'Air',
    'DEMO_PM10_BY_PRODUCTION',
    'PM10 Emission from Production',
    'Demonstration estimate of PM10 emissions using an industry-specific coefficient.',
    'annual_production * pm10_coefficient',
    '{"required_inputs":["annual_production"]}',
    '{"Low":30,"Moderate":60,"High":80}',
    1.000,
    'MVP-DEMO-1',
    'PLACEHOLDER - replace with validated methodology',
    TRUE
);


-- ===============================================================
-- 23. CONNECT RULES TO ENGINEERING COEFFICIENTS
-- ===============================================================
--
-- Carbon rule -> industry carbon coefficient
-- Water rule  -> industry water coefficient
-- Waste rule  -> industry waste coefficient
-- Air rule    -> industry PM10 coefficient
--
-- The actual industry selection is handled by the application
-- when selecting the correct coefficient for the project industry.
-- ===============================================================

INSERT INTO calculation_rule_coefficients
(
    rule_id,
    coefficient_id,
    parameter_name,
    coefficient_order
)
SELECT
    r.id,
    c.id,
    CASE
        WHEN c.factor = 'Carbon' THEN 'carbon_coefficient'
        WHEN c.factor = 'Water'  THEN 'water_coefficient'
        WHEN c.factor = 'Waste'  THEN 'waste_coefficient'
        WHEN c.factor = 'Air'    THEN 'pm10_coefficient'
    END,
    1
FROM calculation_rules r
JOIN engineering_coefficients c
    ON (
        (r.rule_code = 'DEMO_CARBON_BY_PRODUCTION' AND c.factor = 'Carbon')
        OR
        (r.rule_code = 'DEMO_WATER_BY_PRODUCTION'  AND c.factor = 'Water')
        OR
        (r.rule_code = 'DEMO_WASTE_BY_PRODUCTION'  AND c.factor = 'Waste')
        OR
        (r.rule_code = 'DEMO_PM10_BY_PRODUCTION'    AND c.factor = 'Air')
    )
WHERE c.coefficient_code LIKE 'DEMO_%';


-- ===============================================================
-- 24. OPTIONAL VIEW:
--     CALCULATION RULE + COEFFICIENT INFORMATION
-- ===============================================================
--
-- Makes it easier for the backend/admin dashboard to inspect
-- which coefficients belong to which calculation rules.
-- ===============================================================

CREATE OR REPLACE VIEW calculation_rule_coefficient_view AS
SELECT
    r.id                  AS rule_id,
    r.rule_code,
    r.rule_name,
    r.factor              AS rule_factor,
    r.formula,

    c.id                  AS coefficient_id,
    c.industry,
    c.coefficient_code,
    c.coefficient_name,
    c.value                AS coefficient_value,
    c.unit                 AS coefficient_unit,
    c.source               AS coefficient_source,
    c.reference            AS coefficient_reference,
    c.methodology_version  AS coefficient_methodology_version,

    crc.parameter_name,
    crc.coefficient_order

FROM calculation_rules r
JOIN calculation_rule_coefficients crc
    ON crc.rule_id = r.id
JOIN engineering_coefficients c
    ON c.id = crc.coefficient_id;


-- ===============================================================
-- END OF 001_init.sql
-- ===============================================================
