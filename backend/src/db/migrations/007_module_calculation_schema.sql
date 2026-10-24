-- ===============================================================
-- 007_module_calculation_schema.sql
-- ===============================================================
--
-- A module-driven calculation schema, replacing the calculation
-- side of 001_init.sql.
--
-- WHY A NEW SET OF TABLES
--
-- The original calculation tables were shaped for a weighted
-- 0-100 scoring system:
--
--   impact_results.score       NUMERIC(5,2) CHECK (0..100)
--   impact_results.risk_level  CHECK IN ('Low','Moderate','High')
--
-- There is no column anywhere for a physical quantity. A result of
-- "4230 t CO2/year" has nowhere to go. The specification we
-- implement forbids those scores outright -- "Do not release 0-100
-- individual module scores until a separately documented,
-- justified and validated scoring rule is approved for each
-- module" -- and asks instead for value + unit + status, which is
-- what module_results below stores.
--
-- Every one of those tables also hard-codes the module list:
--
--   CHECK (factor IN ('Air','Water','Ecology','Carbon',
--                     'Resource','Waste','Noise'))
--
-- appears on engineering_coefficients, calculation_rules,
-- impact_results and assessment_inputs. Adding an eighth module
-- means altering four constraints. Here a module is a ROW in
-- `modules` and every other table references it by foreign key,
-- so adding one is an INSERT.
--
-- WHAT IS REUSED
--
-- users, projects, project_locations, assessments,
-- project_documents, regulatory_standards, environmental_data,
-- regional_baseline and the GIS tables are untouched: the frontend
-- works against them and they were never the problem.
--
-- WHAT BECOMES UNUSED
--
-- engineering_coefficients, calculation_rules,
-- calculation_rule_coefficients, calculation_engine_runs,
-- impact_results and assessment_inputs are left in place and stop
-- being written to. The migration runner refuses to apply a file
-- containing a destructive statement, so retiring them is a
-- separate, deliberate step once the new path is proven.
--
-- Applied once and recorded in schema_migrations; written so a
-- second application would change nothing.
-- ===============================================================


-- ===============================================================
-- 1. MODULES
-- ===============================================================
--
-- The registry that makes this schema extensible. Five rows are
-- seeded now (Noise, Water, Carbon, Resource, Waste); Air and
-- Ecology arrive as rows when their blocking reference data does
-- (the CPCB AQI breakpoint table, authoritative protected-area
-- geometry). Nothing in this file names any module.
-- ===============================================================

CREATE TABLE IF NOT EXISTS modules (
    code            VARCHAR(30) PRIMARY KEY,

    name            VARCHAR(120) NOT NULL,

    description     TEXT,

    -- What the module sets out to report, shown in the UI above
    -- its results and when it has none yet.
    purpose         TEXT,

    display_order   INTEGER NOT NULL DEFAULT 100,

    -- A module with enabled = FALSE keeps its parameters,
    -- constants and limits but is skipped by the engine. This is
    -- how Air and Ecology can sit in the database while their
    -- reference data is still missing, rather than being absent.
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,

    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_modules_code_shape
        CHECK (code = UPPER(code) AND code <> '')
);


-- ===============================================================
-- 2. MODULE PARAMETERS
-- ===============================================================
--
-- What the platform asks the user for. One row per question. The
-- input form is generated from these rows, so adding a question is
-- an INSERT and not a frontend change.
-- ===============================================================

CREATE TABLE IF NOT EXISTS module_parameters (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    module_code     VARCHAR(30) NOT NULL,

    -- Stable machine name used by the engine, e.g. 'leq_day'.
    -- Globally unique rather than unique per module: a quantity
    -- used by two modules (annual_production feeds both Carbon and
    -- Resource) is one question, asked once, owned by whichever
    -- module declares it.
    code            VARCHAR(80) NOT NULL UNIQUE,

    label           VARCHAR(200) NOT NULL,

    -- The unit the value must be entered in. The engine refuses to
    -- compute when a stored value's unit differs, rather than
    -- guessing a conversion.
    unit            VARCHAR(50),

    value_type      VARCHAR(20) NOT NULL DEFAULT 'numeric',

    -- Allowed values when value_type = 'enum', such as the noise
    -- area categories. A JSON array of strings.
    enum_values     JSONB,

    -- Shown under the field. The specification requires the
    -- reporting period and basis to be explicit on every quantity,
    -- and this is where that instruction reaches the user.
    help_text       TEXT,

    -- TRUE when at least one of the module's outputs cannot be
    -- computed without it. Never enforced as NOT NULL on the
    -- value: an unavailable input must be allowed through so the
    -- result can be NOT_CALCULATED_MISSING_INPUT. The
    -- specification is explicit -- "do not block the user into
    -- inventing a number".
    required        BOOLEAN NOT NULL DEFAULT FALSE,

    display_order   INTEGER NOT NULL DEFAULT 100,

    active          BOOLEAN NOT NULL DEFAULT TRUE,

    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_module_parameters_module
        FOREIGN KEY (module_code) REFERENCES modules(code)
        ON DELETE CASCADE,

    CONSTRAINT chk_module_parameters_value_type
        CHECK (value_type IN ('numeric', 'text', 'enum')),

    -- An enum question with no options is unanswerable.
    CONSTRAINT chk_module_parameters_enum
        CHECK (value_type <> 'enum' OR enum_values IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_module_parameters_module
    ON module_parameters(module_code);


-- ===============================================================
-- 3. MODULE CONSTANTS
-- ===============================================================
--
-- Emission factors and other published multipliers. Replaces
-- engineering_coefficients, whose input mapping columns
-- (input_parameter, input_unit, result_unit) were NULL on 42 of
-- its 54 real rows, which made those rows unusable by any engine.
-- Here the mapping is NOT NULL, so an unusable constant cannot be
-- stored in the first place.
-- ===============================================================

CREATE TABLE IF NOT EXISTS module_constants (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    module_code         VARCHAR(30) NOT NULL,

    code                VARCHAR(100) NOT NULL UNIQUE,

    label               VARCHAR(200) NOT NULL,

    value               NUMERIC(24,10) NOT NULL,

    -- The constant's own unit, e.g. 't CO2/t'.
    unit                VARCHAR(100) NOT NULL,

    -- The parameter this constant multiplies. NOT NULL on purpose:
    -- a factor nobody can apply is reference material, not a
    -- constant, and belongs in a document or in module_limits.
    applies_to          VARCHAR(80) NOT NULL,

    -- The unit of applies_to that this constant assumes. The
    -- engine compares it with the stored value's unit and refuses
    -- to multiply on a mismatch.
    expects_unit        VARCHAR(50) NOT NULL,

    result_unit         VARCHAR(100) NOT NULL,

    -- Free-form grouping the engine reads, e.g.
    -- {"carbon_pool": "biogenic"} to keep biogenic CO2 out of the
    -- fossil total as the 2006 IPCC Guidelines require.
    tags                JSONB,

    source              VARCHAR(200) NOT NULL,

    citation            TEXT NOT NULL,

    source_url          TEXT,

    -- The published edition this value came from, e.g. 'IPCC 2006'
    -- or CEA 'v22.0'. Carried onto every result, so a report can
    -- state which version produced the number.
    version             VARCHAR(50),

    retrieved_on        DATE,

    -- FALSE until a person has checked the value against the
    -- source document. Results built on unverified constants are
    -- labelled provisional rather than withheld.
    verified            BOOLEAN NOT NULL DEFAULT FALSE,

    verified_by         UUID,

    verified_on         DATE,

    notes               TEXT,

    active              BOOLEAN NOT NULL DEFAULT TRUE,

    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_module_constants_module
        FOREIGN KEY (module_code) REFERENCES modules(code)
        ON DELETE CASCADE,

    CONSTRAINT fk_module_constants_verifier
        FOREIGN KEY (verified_by) REFERENCES users(id)
        ON DELETE SET NULL,

    CONSTRAINT chk_module_constants_value
        CHECK (value >= 0),

    CONSTRAINT chk_module_constants_verified
        CHECK (
            (verified = FALSE AND verified_on IS NULL)
            OR (verified = TRUE AND verified_on IS NOT NULL)
        )
);

CREATE INDEX IF NOT EXISTS idx_module_constants_module
    ON module_constants(module_code);

CREATE INDEX IF NOT EXISTS idx_module_constants_applies_to
    ON module_constants(applies_to);


-- ===============================================================
-- 4. MODULE LIMITS
-- ===============================================================
--
-- Published thresholds that a calculated or measured value is
-- compared against: the Noise Rules 2000 ambient limits, NAAQS,
-- the CPCB designated-best-use water criteria.
--
-- `selector` is what makes a limit findable without one column per
-- discriminator. A noise limit is selected by
-- {"zone":"Industrial","period":"day"}; a water criterion by
-- {"class":"A"}; a NAAQS limit by
-- {"area":"residential","averaging":"24h"}. The engine builds the
-- same object from the assessment and matches on equality, so a
-- new kind of discriminator needs no migration.
-- ===============================================================

CREATE TABLE IF NOT EXISTS module_limits (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    module_code         VARCHAR(30) NOT NULL,

    code                VARCHAR(100) NOT NULL UNIQUE,

    label               VARCHAR(200) NOT NULL,

    -- What is being limited: a module_parameters.code for a
    -- measured quantity, or a module_outputs.code for a calculated
    -- one. Deliberately not a foreign key -- a limit may be seeded
    -- for a parameter a later module will introduce.
    subject             VARCHAR(80) NOT NULL,

    selector            JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- 'max'   - subject must not exceed value
    -- 'min'   - subject must not fall below value
    -- 'range' - subject must lie within [value, value_max], as
    --           pH 6.5-8.5 does
    comparison          VARCHAR(10) NOT NULL,

    value               NUMERIC(24,8) NOT NULL,

    value_max           NUMERIC(24,8),

    unit                VARCHAR(50) NOT NULL,

    -- CPCB publishes AQI sub-indices and MPCB a Water Quality
    -- Index. An index is never comparable with a regulatory limit,
    -- and this flag stops the engine treating one as if it were.
    is_index            BOOLEAN NOT NULL DEFAULT FALSE,

    source              VARCHAR(200) NOT NULL,

    citation            TEXT NOT NULL,

    source_url          TEXT,

    version             VARCHAR(50),

    effective_from      DATE,

    verified            BOOLEAN NOT NULL DEFAULT FALSE,

    verified_by         UUID,

    verified_on         DATE,

    notes               TEXT,

    active              BOOLEAN NOT NULL DEFAULT TRUE,

    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_module_limits_module
        FOREIGN KEY (module_code) REFERENCES modules(code)
        ON DELETE CASCADE,

    CONSTRAINT fk_module_limits_verifier
        FOREIGN KEY (verified_by) REFERENCES users(id)
        ON DELETE SET NULL,

    CONSTRAINT chk_module_limits_comparison
        CHECK (comparison IN ('max', 'min', 'range')),

    CONSTRAINT chk_module_limits_range
        CHECK (
            (comparison <> 'range' AND value_max IS NULL)
            OR (comparison = 'range' AND value_max IS NOT NULL
                AND value_max >= value)
        ),

    CONSTRAINT chk_module_limits_verified
        CHECK (
            (verified = FALSE AND verified_on IS NULL)
            OR (verified = TRUE AND verified_on IS NOT NULL)
        )
);

CREATE INDEX IF NOT EXISTS idx_module_limits_module
    ON module_limits(module_code);

CREATE INDEX IF NOT EXISTS idx_module_limits_subject
    ON module_limits(subject);

CREATE INDEX IF NOT EXISTS idx_module_limits_selector
    ON module_limits USING GIN (selector);


-- ===============================================================
-- 5. MODULE OUTPUTS
-- ===============================================================
--
-- What each module produces: the catalogue of results, so the UI
-- can say "total waste: not calculated yet" for an output that has
-- never run, instead of showing nothing at all.
--
-- `formula_text` is the human-readable formula shown in the UI and
-- cited in the report. It is documentation and is never parsed:
-- the engine resolves `code` to a registered Python function in
-- analytics-service/app/calculations/modules/. Storing the formula
-- as prose and executing reviewed code avoids an expression
-- evaluator reading strings out of the database.
-- ===============================================================

CREATE TABLE IF NOT EXISTS module_outputs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    module_code     VARCHAR(30) NOT NULL,

    code            VARCHAR(80) NOT NULL UNIQUE,

    label           VARCHAR(200) NOT NULL,

    unit            VARCHAR(50),

    formula_text    TEXT NOT NULL,

    -- The shape of the calculation, for the UI and for review:
    -- 'product'    - input x constant
    -- 'sum'        - sum of inputs, or of other outputs
    -- 'ratio'      - one input or output divided by another
    -- 'difference' - subtraction, as noise exceedance is
    -- 'clamped'    - a difference floored at zero, as supply gap is
    -- 'lookup'     - table lookup, with interpolation if needed
    -- 'geometry'   - derived from spatial data
    operation       VARCHAR(20) NOT NULL,

    -- TRUE when the result is meaningful to compare against a
    -- module_limits row. FALSE for a quantity with no published
    -- threshold, which the specification says is most of them:
    -- "No universal cross-sector pass/fail benchmark is defined."
    comparable      BOOLEAN NOT NULL DEFAULT FALSE,

    -- Printed with the result whenever it is shown. This is where
    -- the AP-42 caveat and the tCO2-not-tCO2e distinction live.
    limitation_note TEXT,

    display_order   INTEGER NOT NULL DEFAULT 100,

    active          BOOLEAN NOT NULL DEFAULT TRUE,

    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_module_outputs_module
        FOREIGN KEY (module_code) REFERENCES modules(code)
        ON DELETE CASCADE,

    CONSTRAINT chk_module_outputs_operation
        CHECK (operation IN ('product', 'sum', 'ratio', 'difference',
                             'clamped', 'lookup', 'geometry'))
);

CREATE INDEX IF NOT EXISTS idx_module_outputs_module
    ON module_outputs(module_code);


-- ===============================================================
-- 6. ASSESSMENT PARAMETER VALUES
-- ===============================================================
--
-- What the user entered. Replaces assessment_inputs, whose
-- category CHECK enumerated the modules and whose free-text
-- parameter_name was not tied to anything the engine could
-- resolve.
--
-- The stored fields follow the specification's mandatory list:
-- value, unit, source type, source reference, observation date,
-- method, status and any assumption.
-- ===============================================================

CREATE TABLE IF NOT EXISTS assessment_parameter_values (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    assessment_id       UUID NOT NULL,

    parameter_code      VARCHAR(80) NOT NULL,

    value_numeric       NUMERIC(24,8),

    value_text          TEXT,

    -- Recorded as entered. The engine compares it with
    -- module_parameters.unit and refuses the calculation on a
    -- mismatch rather than converting silently.
    unit                VARCHAR(50),

    -- "FY 2024-25", "year", "day". The specification requires a
    -- period on every quantity, and a ratio of two values from
    -- different periods is meaningless.
    reporting_period    VARCHAR(50),

    -- Where the number came from. Drives how the result is
    -- labelled: a LAB_MEASURED input and an ESTIMATED one produce
    -- the same arithmetic and must not look alike in a report.
    source_status       VARCHAR(30) NOT NULL DEFAULT 'USER_REPORTED',

    source_reference    TEXT,

    -- The date the measurement or bill refers to, as opposed to
    -- the date it was typed in.
    observed_on         DATE,

    method              VARCHAR(200),

    assumption          TEXT,

    evidence_document_id UUID,

    entered_by          UUID,

    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_apv_assessment
        FOREIGN KEY (assessment_id) REFERENCES assessments(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_apv_parameter
        FOREIGN KEY (parameter_code) REFERENCES module_parameters(code)
        ON DELETE RESTRICT,

    CONSTRAINT fk_apv_document
        FOREIGN KEY (evidence_document_id)
        REFERENCES project_documents(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_apv_user
        FOREIGN KEY (entered_by) REFERENCES users(id)
        ON DELETE SET NULL,

    -- One answer per question per assessment; re-entering updates.
    CONSTRAINT uq_apv_assessment_parameter
        UNIQUE (assessment_id, parameter_code),

    CONSTRAINT chk_apv_source_status
        CHECK (
            source_status IN (
                'OFFICIAL_LIVE',
                'OFFICIAL_REFERENCE',
                'USER_REPORTED',
                'USER_DOCUMENTED',
                'LAB_MEASURED',
                'GIS_DERIVED',
                'ESTIMATED',
                'STALE',
                'UNAVAILABLE',
                'UNVERIFIED'
            )
        ),

    -- A row with neither value is the explicit "unavailable"
    -- answer, which is allowed: it records that the question was
    -- seen and could not be answered, and that is what turns a
    -- result into NOT_CALCULATED_MISSING_INPUT rather than silence.
    CONSTRAINT chk_apv_unavailable
        CHECK (
            value_numeric IS NOT NULL
            OR value_text IS NOT NULL
            OR source_status = 'UNAVAILABLE'
        )
);

CREATE INDEX IF NOT EXISTS idx_apv_assessment
    ON assessment_parameter_values(assessment_id);

CREATE INDEX IF NOT EXISTS idx_apv_parameter
    ON assessment_parameter_values(parameter_code);


-- ===============================================================
-- 7. CALCULATION RUNS
-- ===============================================================
--
-- One execution of the engine over one assessment. Holds the
-- input and reference snapshot the specification requires for
-- reproducibility: "Store each assessment run and its
-- input/reference snapshot so results are reproducible."
-- ===============================================================

CREATE TABLE IF NOT EXISTS calculation_runs (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    assessment_id       UUID NOT NULL,

    engine_version      VARCHAR(50) NOT NULL,

    status              VARCHAR(20) NOT NULL DEFAULT 'running',

    -- Every parameter value as it stood when the run started, and
    -- the code plus version of every constant and limit used.
    -- Enough to re-derive the results after the reference data has
    -- moved on.
    input_snapshot      JSONB,

    reference_snapshot  JSONB,

    -- Counts by status, so a list of runs renders without reading
    -- every result row.
    summary             JSONB,

    started_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    completed_at        TIMESTAMP,

    duration_ms         INTEGER,

    error_message       TEXT,

    triggered_by        UUID,

    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_calculation_runs_assessment
        FOREIGN KEY (assessment_id) REFERENCES assessments(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_calculation_runs_user
        FOREIGN KEY (triggered_by) REFERENCES users(id)
        ON DELETE SET NULL,

    CONSTRAINT chk_calculation_runs_status
        CHECK (status IN ('running', 'completed', 'failed')),

    CONSTRAINT chk_calculation_runs_duration
        CHECK (duration_ms IS NULL OR duration_ms >= 0)
);

CREATE INDEX IF NOT EXISTS idx_calculation_runs_assessment
    ON calculation_runs(assessment_id);


-- ===============================================================
-- 8. MODULE RESULTS
-- ===============================================================
--
-- One row per output per run. The table that replaces
-- impact_results.
--
-- The differences that matter:
--
--   value_numeric is an unbounded NUMERIC, not a 0-100 score, so
--   it can hold 4230.5 t CO2/year.
--
--   unit is stored beside it, because a number without its unit is
--   not a result.
--
--   status distinguishes "calculated" from the several ways a
--   calculation can legitimately not happen, so a missing result
--   is never an implied zero.
--
--   comparison is the verdict against a published limit, and
--   'not_compared' is a first-class answer: most outputs have no
--   universal threshold and must say so rather than appear to pass.
--
--   inputs_used and constants_used make the row self-explaining.
--   It carries the numbers and the citations that produced it.
-- ===============================================================

CREATE TABLE IF NOT EXISTS module_results (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    run_id              UUID NOT NULL,

    assessment_id       UUID NOT NULL,

    module_code         VARCHAR(30) NOT NULL,

    output_code         VARCHAR(80) NOT NULL,

    value_numeric       NUMERIC(24,8),

    value_text          TEXT,

    unit                VARCHAR(50),

    status              VARCHAR(40) NOT NULL,

    -- Which parameter codes were absent, when status is
    -- NOT_CALCULATED_MISSING_INPUT. This is what lets the UI say
    -- "enter annual production to get carbon intensity" instead of
    -- just "not calculated".
    missing_inputs      JSONB,

    comparison          VARCHAR(20) NOT NULL DEFAULT 'not_compared',

    limit_code          VARCHAR(100),

    limit_value         NUMERIC(24,8),

    limit_unit          VARCHAR(50),

    -- [{code, label, value, unit, source_status}, ...]
    inputs_used         JSONB,

    -- [{code, value, unit, source, version, verified}, ...]
    constants_used      JSONB,

    -- Copied from module_outputs at run time, so a report printed
    -- later shows the formula that actually ran.
    formula_text        TEXT,

    limitation_note     TEXT,

    -- Set when any constant or limit involved has verified = FALSE.
    -- The result is still shown; it is labelled.
    provisional         BOOLEAN NOT NULL DEFAULT FALSE,

    calculated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_module_results_run
        FOREIGN KEY (run_id) REFERENCES calculation_runs(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_module_results_assessment
        FOREIGN KEY (assessment_id) REFERENCES assessments(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_module_results_module
        FOREIGN KEY (module_code) REFERENCES modules(code)
        ON DELETE RESTRICT,

    CONSTRAINT uq_module_results_run_output
        UNIQUE (run_id, output_code),

    CONSTRAINT chk_module_results_status
        CHECK (
            status IN (
                'CALCULATED',
                'NOT_CALCULATED_MISSING_INPUT',
                'NOT_CALCULATED_UNIT_MISMATCH',
                'NOT_CALCULATED_NO_FACTOR',
                'NOT_APPLICABLE',
                'VERIFICATION_REQUIRED'
            )
        ),

    CONSTRAINT chk_module_results_comparison
        CHECK (
            comparison IN ('within_limit', 'outside_limit', 'not_compared')
        ),

    -- A calculated result must carry a number, and anything else
    -- must not pretend to. This is the constraint that makes a
    -- silent zero impossible.
    CONSTRAINT chk_module_results_value
        CHECK (
            (status = 'CALCULATED'
             AND (value_numeric IS NOT NULL OR value_text IS NOT NULL))
            OR (status <> 'CALCULATED' AND value_numeric IS NULL)
        ),

    -- A verdict requires the limit it was reached against.
    CONSTRAINT chk_module_results_limit
        CHECK (
            comparison = 'not_compared'
            OR (limit_code IS NOT NULL AND limit_value IS NOT NULL)
        )
);

CREATE INDEX IF NOT EXISTS idx_module_results_run
    ON module_results(run_id);

CREATE INDEX IF NOT EXISTS idx_module_results_assessment
    ON module_results(assessment_id);

CREATE INDEX IF NOT EXISTS idx_module_results_module
    ON module_results(module_code);


-- ===============================================================
-- END OF 007_module_calculation_schema.sql
-- ===============================================================
