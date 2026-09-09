-- 001_init.sql
-- Core schema for the AI-Assisted EIA Platform
-- Requires the PostGIS extension for geospatial storage/queries.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------
-- users
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name          VARCHAR(150) NOT NULL,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name               VARCHAR(200) NOT NULL,
    industry           VARCHAR(100) NOT NULL,
    capacity           NUMERIC(14, 2),
    capacity_unit      VARCHAR(50),
    land_area_hectares NUMERIC(14, 2),
    status             VARCHAR(30) NOT NULL DEFAULT 'draft', -- draft | screened | assessed | reported
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);

-- ---------------------------------------------------------------
-- project_parameters (technical / environmental inputs)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_parameters (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id                  UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
    water_requirement_m3_day    NUMERIC(14, 2),
    power_requirement_mw        NUMERIC(14, 2),
    fuel_type                   VARCHAR(100),
    operating_hours_per_day     NUMERIC(5, 2),
    employees                   INTEGER,
    raw_material_consumption    JSONB,
    waste_generation_t_year     NUMERIC(14, 2),
    emission_control_equipment  TEXT,
    extra_parameters            JSONB,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------
-- locations (PostGIS point geometry, SRID 4326)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS locations (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id  UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
    latitude    DOUBLE PRECISION NOT NULL,
    longitude   DOUBLE PRECISION NOT NULL,
    geom        GEOMETRY(Point, 4326) NOT NULL,
    address     VARCHAR(300),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_locations_geom ON locations USING GIST (geom);

-- ---------------------------------------------------------------
-- environmental_data (baseline observations)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS environmental_data (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    category        VARCHAR(50) NOT NULL, -- air | weather | water | land
    parameter_name  VARCHAR(100) NOT NULL, -- e.g. PM2.5, PM10, pH, BOD
    value           NUMERIC(14, 4),
    unit            VARCHAR(30),
    source          VARCHAR(150),
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_environmental_data_project_id ON environmental_data(project_id);

-- ---------------------------------------------------------------
-- predictions (ML risk outputs)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS predictions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    air_risk        NUMERIC(5, 2),
    water_risk      NUMERIC(5, 2),
    waste_risk      NUMERIC(5, 2),
    overall_risk    NUMERIC(5, 2),
    classification  VARCHAR(20), -- Low | Moderate | High | Very High
    main_factors    JSONB,
    model_version   VARCHAR(50),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_predictions_project_id ON predictions(project_id);

-- ---------------------------------------------------------------
-- recommendations (mitigation measures)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recommendations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    prediction_id   UUID REFERENCES predictions(id) ON DELETE SET NULL,
    issue           VARCHAR(200) NOT NULL,
    recommendation  TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recommendations_project_id ON recommendations(project_id);

-- ---------------------------------------------------------------
-- reports (generated PDF metadata)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reports (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    file_path     VARCHAR(500) NOT NULL,
    generated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_project_id ON reports(project_id);
