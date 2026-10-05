-- ===============================================================
-- 005_reference_data_verification.sql
-- ===============================================================
--
-- Aligns engineering_coefficients and regulatory_standards with the
-- data-collection sheets in docs/data-collection/, so a filled sheet
-- loads column for column, and records who verified each value.
--
-- Idempotent: migrate.js runs every migration file on each invocation.
-- ===============================================================


-- ===============================================================
-- 1. ENGINEERING COEFFICIENTS
-- ===============================================================
--
-- A coefficient is applied as:
--
--     assessment input (input_parameter, in input_unit)
--       x value (in unit)
--       = result (in result_unit)
--
-- e.g. coal_consumption [t/year] x 1.9 [t CO2/t coal] = [t CO2/year]
-- ===============================================================

ALTER TABLE engineering_coefficients
    ADD COLUMN IF NOT EXISTS input_parameter VARCHAR(100);

ALTER TABLE engineering_coefficients
    ADD COLUMN IF NOT EXISTS input_unit VARCHAR(100);

ALTER TABLE engineering_coefficients
    ADD COLUMN IF NOT EXISTS result_unit VARCHAR(100);

ALTER TABLE engineering_coefficients
    ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE engineering_coefficients
    ADD COLUMN IF NOT EXISTS verified_by VARCHAR(150);

ALTER TABLE engineering_coefficients
    ADD COLUMN IF NOT EXISTS verified_on DATE;

ALTER TABLE engineering_coefficients
    ADD COLUMN IF NOT EXISTS notes TEXT;


-- 'All' marks a coefficient that applies to every industry (fuel
-- combustion, grid electricity), matching regulatory_standards.zone = 'All'.
UPDATE engineering_coefficients
    SET industry = 'All'
    WHERE industry IS NULL;

ALTER TABLE engineering_coefficients
    ALTER COLUMN industry SET DEFAULT 'All';

ALTER TABLE engineering_coefficients
    ALTER COLUMN industry SET NOT NULL;


-- The three calculation columns are filled together or not at all.
-- The demo rows from 001 leave all three empty, so they are never
-- picked up by a calculation.
ALTER TABLE engineering_coefficients
    DROP CONSTRAINT IF EXISTS chk_engineering_coefficients_calculation;

ALTER TABLE engineering_coefficients
    ADD CONSTRAINT chk_engineering_coefficients_calculation
        CHECK (num_nulls(input_parameter, input_unit, result_unit) IN (0, 3));


-- A verified value must say who checked it and when.
ALTER TABLE engineering_coefficients
    DROP CONSTRAINT IF EXISTS chk_engineering_coefficients_verified;

ALTER TABLE engineering_coefficients
    ADD CONSTRAINT chk_engineering_coefficients_verified
        CHECK (
            NOT verified
            OR (verified_by IS NOT NULL AND verified_on IS NOT NULL)
        );


CREATE INDEX IF NOT EXISTS idx_engineering_coefficients_input_parameter
    ON engineering_coefficients(input_parameter);


-- ===============================================================
-- 2. REGULATORY STANDARDS
-- ===============================================================

ALTER TABLE regulatory_standards
    ADD COLUMN IF NOT EXISTS verified_by VARCHAR(150);

ALTER TABLE regulatory_standards
    ADD COLUMN IF NOT EXISTS verified_on DATE;


-- Notified zone names can be long, e.g. CPCB's "Class A - drinking water
-- source without conventional treatment" (62 characters).
ALTER TABLE regulatory_standards
    ALTER COLUMN zone TYPE VARCHAR(150);

ALTER TABLE regulatory_standards
    ALTER COLUMN averaging_period TYPE VARCHAR(100);


-- A range such as pH 6.5-8.5 is two rows that differ only in limit_type,
-- so limit_type belongs in the unique key. The constraint keeps its name
-- because 003's seed uses ON CONFLICT ON CONSTRAINT uq_regulatory_standards.
ALTER TABLE regulatory_standards
    DROP CONSTRAINT IF EXISTS uq_regulatory_standards;

ALTER TABLE regulatory_standards
    ADD CONSTRAINT uq_regulatory_standards
        UNIQUE (parameter_name, standard_name, zone, averaging_period, limit_type);


ALTER TABLE regulatory_standards
    DROP CONSTRAINT IF EXISTS chk_regulatory_standards_verified;

ALTER TABLE regulatory_standards
    ADD CONSTRAINT chk_regulatory_standards_verified
        CHECK (
            NOT verified
            OR (verified_by IS NOT NULL AND verified_on IS NOT NULL)
        );


-- ===============================================================
-- END OF 005_reference_data_verification.sql
-- ===============================================================
