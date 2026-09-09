-- ===============================================================
-- AI-ASSISTED ENVIRONMENTAL IMPACT ASSESSMENT (EIA) PLATFORM
-- Final Database Schema (MVP)
--
-- PostgreSQL + PostGIS
--
-- This script replaces the previous schema.
-- Existing tables are dropped because the database currently
-- contains no important data.
-- ===============================================================


-- ===============================================================
-- 1. EXTENSIONS
-- ===============================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ===============================================================
-- 2. DROP EXISTING TABLES
-- ===============================================================

DROP TABLE IF EXISTS data_fetch_logs CASCADE;
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS recommendations CASCADE;
DROP TABLE IF EXISTS impact_results CASCADE;
DROP TABLE IF EXISTS calculation_rules CASCADE;
DROP TABLE IF EXISTS environmental_data CASCADE;
DROP TABLE IF EXISTS assessment_inputs CASCADE;
DROP TABLE IF EXISTS assessments CASCADE;
DROP TABLE IF EXISTS project_documents CASCADE;
DROP TABLE IF EXISTS project_locations CASCADE;
DROP TABLE IF EXISTS data_sources CASCADE;
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


CREATE INDEX idx_project_documents_uploaded_by
    ON project_documents(uploaded_by);


-- ===============================================================
-- 7. ASSESSMENTS
-- ===============================================================
--
-- One project can have multiple assessments.
--
-- Example:
--
-- Project
--   ├── Assessment 1
--   ├── Assessment 2
--   └── Assessment 3
--
-- Each assessment represents a separate evaluation/version.
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
--
-- Stores parameters supplied for a particular assessment.
--
-- Examples:
-- Air      -> PM10
-- Water    -> Water Consumption
-- Resource -> Energy Consumption
-- etc.
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
--
-- Defines where environmental data comes from.
--
-- Examples:
-- OpenWeather
-- OpenAQ
-- NASA POWER
-- Government environmental datasets
-- Internal datasets
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
--
-- Stores environmental observations associated with an assessment.
--
-- Examples:
--
-- Air:
-- PM2.5
-- PM10
-- NO2
--
-- Water:
-- pH
-- BOD
-- COD
--
-- Weather:
-- Temperature
-- Humidity
-- Wind Speed
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
-- 11. CALCULATION RULES
-- ===============================================================
--
-- Stores the rules/formulas used to calculate environmental impacts.
--
-- Example:
--
-- factor:
-- Carbon
--
-- formula:
-- activity * emission_factor
--
-- conditions:
-- JSONB
--
-- thresholds:
-- JSONB
-- ===============================================================

CREATE TABLE calculation_rules (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    factor              VARCHAR(50) NOT NULL,

    rule_code           VARCHAR(50) NOT NULL UNIQUE,

    rule_name           VARCHAR(200) NOT NULL,

    description         TEXT,

    formula             TEXT,

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
-- 12. IMPACT RESULTS
-- ===============================================================
--
-- Stores the result of applying a calculation rule to an assessment.
--
-- Example:
--
-- Assessment
--     ↓
-- Carbon Rule
--     ↓
-- Impact Result
--     ↓
-- Score = 72
-- Risk = High
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
-- 13. RECOMMENDATIONS
-- ===============================================================
--
-- Recommendations can be generated from specific impact results.
--
-- Example:
--
-- High Air Risk
--      ↓
-- Recommendation
--      ↓
-- Install/improve particulate control system
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
-- 14. REPORTS
-- ===============================================================
--
-- Stores metadata for generated EIA reports.
-- The actual PDF file can be stored on disk/cloud/object storage.
-- file_path stores the location of that file.
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
-- 15. DATA FETCH LOGS
-- ===============================================================
--
-- OPTIONAL TABLE
--
-- Records external environmental-data API requests.
--
-- Useful for:
-- - debugging
-- - audit trail
-- - API monitoring
-- - response-time tracking
-- ===============================================================

CREATE TABLE data_fetch_logs (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    assessment_id     UUID NOT NULL,

    source_id         UUID NOT NULL,

    request_type      VARCHAR(100),

    request_parameters JSONB,

    status             VARCHAR(30),

    response_time_ms   INTEGER,

    error_message      TEXT,

    fetched_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

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
-- 16. HELPER FUNCTION FOR POSTGIS GEOMETRY
-- ===============================================================
--
-- Automatically creates geom from latitude/longitude.
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
-- 17. UPDATED_AT HELPER
-- ===============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- Users
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


-- Projects
CREATE TRIGGER trg_projects_updated_at
BEFORE UPDATE ON projects
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


-- Assessments
CREATE TRIGGER trg_assessments_updated_at
BEFORE UPDATE ON assessments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


-- Assessment Inputs
CREATE TRIGGER trg_assessment_inputs_updated_at
BEFORE UPDATE ON assessment_inputs
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


-- Data Sources
CREATE TRIGGER trg_data_sources_updated_at
BEFORE UPDATE ON data_sources
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


-- Calculation Rules
CREATE TRIGGER trg_calculation_rules_updated_at
BEFORE UPDATE ON calculation_rules
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


-- Recommendations
CREATE TRIGGER trg_recommendations_updated_at
BEFORE UPDATE ON recommendations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


-- ===============================================================
-- 18. SCHEMA COMPLETE
-- ===============================================================