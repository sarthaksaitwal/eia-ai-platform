/**
 * Seeds the four reference tables from the CSVs under docs/data-collection/.
 *
 *   npm run seed:reference -- [--dry-run]
 *
 * Sources, all plain CSV so every value is reviewable in git:
 *
 *   collected/engineering_coefficients_collected.csv  -> engineering_coefficients
 *   collected/regulatory_standards_collected.csv      -> regulatory_standards
 *   knowledge_base/engineering_coefficients.csv       -> engineering_coefficients
 *   knowledge_base/regulatory_standards.csv           -> regulatory_standards (noise only)
 *   knowledge_base/calculation_rules.csv              -> calculation_rules
 *   knowledge_base/data_sources.csv                   -> data_sources
 *
 * Every row is validated before anything is written. If any row fails, nothing
 * is written and each problem is printed with its file and line number. The
 * write itself is one transaction, and re-running updates rows in place rather
 * than duplicating them.
 *
 * Rows that cannot be represented in the target table are skipped and listed
 * with the reason, rather than being forced into a column that does not mean
 * what they mean.
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { pool } = require("../config/db");
const { parseCsv } = require("../utils/csv");

const DATA_DIR = path.join(__dirname, "..", "..", "..", "docs", "data-collection");
const COLLECTED = path.join(DATA_DIR, "collected");
const KB = path.join(DATA_DIR, "knowledge_base");

const FACTORS = ["Air", "Water", "Ecology", "Carbon", "Resource", "Waste", "Noise"];
// The workbook writes factors in capitals; the table's CHECK wants title case.
const FACTOR_BY_MODULE = {
  AIR: "Air",
  WATER: "Water",
  ECOLOGY: "Ecology",
  CARBON: "Carbon",
  RESOURCE: "Resource",
  WASTE: "Waste",
  NOISE: "Noise",
};

// The two zone names the 2009 NAAQS notification actually uses. Rows seeded by
// migration 003 under any other zone are superseded by the collected set.
const NAAQS_ZONES = [
  "Industrial, Residential, Rural and Other Area",
  "Ecologically Sensitive Area",
];

const problems = [];
const skipped = [];

function fail(file, line, message) {
  problems.push(`${file}:${line} ${message}`);
}

function read(dir, file) {
  const full = path.join(dir, file);
  if (!fs.existsSync(full)) {
    problems.push(`${file} is missing from ${dir}`);
    return { header: [], records: [] };
  }
  return parseCsv(fs.readFileSync(full, "utf8"));
}

/** Store units the way the notifications print them and the engine normalises them. */
function unit(value) {
  return value
    .replace(/\bug\//g, "µg/")
    .replace(/m3/g, "m³")
    .replace(/^deg C$/, "°C")
    .replace(/micromhos/g, "µmhos")
    .replace(/microcurie/g, "µCi");
}

function bool(value, file, line, column) {
  const text = value.trim().toUpperCase();
  if (text === "TRUE" || text === "1") return true;
  if (text === "FALSE" || text === "0" || text === "") return false;
  fail(file, line, `${column} is ${JSON.stringify(value)}, expected TRUE or FALSE`);
  return false;
}

function dateOrNull(value, file, line, column) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    fail(file, line, `${column} is ${JSON.stringify(value)}, expected YYYY-MM-DD`);
    return null;
  }
  return value;
}

function numberOrFail(value, file, line, column) {
  if (value === "") {
    fail(file, line, `${column} is empty`);
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    fail(file, line, `${column} is ${JSON.stringify(value)}, which is not a number`);
    return null;
  }
  if (parsed < 0) {
    fail(file, line, `${column} is ${parsed}, which is negative`);
    return null;
  }
  return parsed;
}

function jsonOrNull(value, file, line, column) {
  if (!value) return null;
  try {
    JSON.parse(value);
    return value;
  } catch (err) {
    fail(file, line, `${column} is not valid JSON (${err.message})`);
    return null;
  }
}

function limit(value, max, file, line, column) {
  if (value && value.length > max) {
    fail(file, line, `${column} is ${value.length} characters, over the ${max} limit`);
  }
  return value;
}

function requireText(value, file, line, column) {
  if (!value) fail(file, line, `${column} is required but empty`);
  return value;
}

/** A verified row must say who checked it and when; the CHECK constraint agrees. */
function verification(record, file) {
  const verified = bool(record.verified, file, record.__line, "verified");
  if (verified && !(record.verified_by && record.verified_on)) {
    fail(file, record.__line, "verified is TRUE but verified_by or verified_on is empty");
  }
  return {
    verified,
    verified_by: record.verified_by || null,
    verified_on: dateOrNull(record.verified_on, file, record.__line, "verified_on"),
  };
}

// ---------------------------------------------------------------- standards

function collectedStandards() {
  const file = "collected/regulatory_standards_collected.csv";
  const { records } = read(COLLECTED, "regulatory_standards_collected.csv");
  return records.map((r) => {
    const line = r.__line;
    const check = verification(r, file);
    if (r.limit_type !== "maximum" && r.limit_type !== "minimum") {
      fail(file, line, `limit_type is ${JSON.stringify(r.limit_type)}`);
    }
    return {
      category: limit(requireText(r.category, file, line, "category"), 50, file, line, "category"),
      parameter_name: limit(requireText(r.parameter_name, file, line, "parameter_name"), 100, file, line, "parameter_name"),
      display_name: limit(r.display_name, 200, file, line, "display_name") || null,
      standard_name: limit(requireText(r.standard_name, file, line, "standard_name"), 200, file, line, "standard_name"),
      // An ambient or discharge limit applies whatever the industry, and is a
      // concentration rather than a quantity per unit of production.
      industry: "All",
      basis: null,
      zone: limit(requireText(r.zone, file, line, "zone"), 150, file, line, "zone"),
      averaging_period: limit(requireText(r.averaging_period, file, line, "averaging_period"), 100, file, line, "averaging_period"),
      limit_type: r.limit_type,
      limit_value: numberOrFail(r.limit_value, file, line, "limit_value"),
      unit: limit(unit(requireText(r.unit, file, line, "unit")), 50, file, line, "unit"),
      authority: limit(requireText(r.authority, file, line, "authority"), 150, file, line, "authority"),
      reference: r.reference || null,
      effective_from: dateOrNull(r.effective_from, file, line, "effective_from"),
      effective_to: dateOrNull(r.effective_to, file, line, "effective_to"),
      active: bool(r.active, file, line, "active"),
      notes: r.notes || null,
      ...check,
    };
  });
}

/**
 * Of the workbook's 34 standards rows, only the 8 CPCB noise limits are a
 * number with a zone and a time basis, which is what this table stores. The
 * rest are listed as skipped: AQI bands and CGWB categories are index and
 * category values, the ecology rows are spatial tests, the C&D targets are
 * keyed by financial year, and the CGWA rows are thresholds that trigger an
 * impact assessment rather than limits a project can breach.
 */
function knowledgeBaseNoiseStandards() {
  const file = "knowledge_base/regulatory_standards.csv";
  const { records } = read(KB, "regulatory_standards.csv");
  const rows = [];

  for (const r of records) {
    const line = r.__line;
    const module = (r.module || "").toUpperCase();
    const condition = r.condition || "";

    if (module !== "NOISE") {
      skipped.push(`${file}:${line} ${module} "${condition}" - ${skipReason(module)}`);
      continue;
    }

    const match = condition.match(/^(.*)\s+(Day|Night)$/);
    if (!match) {
      skipped.push(`${file}:${line} NOISE "${condition}" - condition is not "<zone> Day" or "<zone> Night"`);
      continue;
    }
    const [, zone, part] = match;
    rows.push({
      category: "Noise",
      parameter_name: part === "Day" ? "leq_day" : "leq_night",
      display_name: `Ambient noise limit, ${part.toLowerCase()}`,
      // Keep the name migration 003 already used so these update in place
      // instead of appearing a second time under a different standard name.
      standard_name: "Ambient Noise Standards 2000",
      industry: "All",
      basis: null,
      zone: zone.trim(),
      averaging_period: part === "Day" ? "Day (06:00-22:00)" : "Night (22:00-06:00)",
      limit_type: "maximum",
      limit_value: numberOrFail(r.max_value, file, line, "max_value"),
      unit: "dB(A)",
      authority: limit(r["standard/source"] ? "CPCB/MoEFCC" : "CPCB", 150, file, line, "authority"),
      reference: r["standard/source"] || null,
      effective_from: null,
      effective_to: null,
      active: true,
      verified: false,
      verified_by: null,
      verified_on: null,
      notes: [r.notes, r.source_reference ? `Source: ${r.source_reference}` : ""]
        .filter(Boolean)
        .join(" | ") || null,
    });
  }
  return rows;
}

function skipReason(module) {
  if (module === "AIR") return "CPCB AQI bands are index categories, not concentration limits";
  if (module === "WATER") return "CGWB categories are text categories, and the CGWA values are assessment triggers rather than limits";
  if (module === "ECOLOGY") return "a spatial/legal test with no numeric limit";
  if (module === "WASTE") return "C&D Rules targets are keyed by financial year, not by zone and averaging period";
  return "no numeric limit with a zone and an averaging period";
}

// ------------------------------------------------------------- coefficients

function coefficientRow(r, file, overrides) {
  const line = r.__line;
  const check = verification(r, file);
  const trio = [r.input_parameter || "", r.input_unit || "", r.result_unit || ""];
  const filled = trio.filter(Boolean).length;
  if (filled !== 0 && filled !== 3) {
    fail(file, line, "input_parameter, input_unit and result_unit must all be filled or all empty");
  }
  return {
    industry: limit(r.industry || "All", 150, file, line, "industry"),
    factor: r.factor,
    coefficient_code: limit(requireText(r.coefficient_code, file, line, "coefficient_code"), 100, file, line, "coefficient_code"),
    coefficient_name: limit(requireText(r.coefficient_name, file, line, "coefficient_name"), 200, file, line, "coefficient_name"),
    input_parameter: limit(r.input_parameter, 100, file, line, "input_parameter") || null,
    input_unit: limit(r.input_unit ? unit(r.input_unit) : "", 100, file, line, "input_unit") || null,
    value: numberOrFail(r.value, file, line, "value"),
    unit: limit(unit(requireText(r.unit, file, line, "unit")), 100, file, line, "unit"),
    result_unit: limit(r.result_unit ? unit(r.result_unit) : "", 100, file, line, "result_unit") || null,
    source: limit(r.source, 200, file, line, "source") || null,
    reference: r.reference || null,
    methodology_version: limit(r.methodology_version, 50, file, line, "methodology_version") || null,
    conditions: jsonOrNull(r.conditions, file, line, "conditions"),
    effective_from: dateOrNull(r.effective_from, file, line, "effective_from"),
    effective_to: dateOrNull(r.effective_to, file, line, "effective_to"),
    active: bool(r.active, file, line, "active"),
    notes: r.notes || null,
    ...check,
    ...overrides,
  };
}

function collectedCoefficients() {
  const file = "collected/engineering_coefficients_collected.csv";
  const { records } = read(COLLECTED, "engineering_coefficients_collected.csv");
  return records.map((r) => {
    if (!FACTORS.includes(r.factor)) fail(file, r.__line, `factor is ${JSON.stringify(r.factor)}`);
    return coefficientRow(r, file);
  });
}

function knowledgeBaseCoefficients() {
  const file = "knowledge_base/engineering_coefficients.csv";
  const { records } = read(KB, "engineering_coefficients.csv");
  return records.map((r) => {
    const module = (r.factor || "").toUpperCase();
    const factor = FACTOR_BY_MODULE[module];
    if (!factor) fail(file, r.__line, `factor is ${JSON.stringify(r.factor)}, which is not a known module`);
    // The workbook has no calculation columns, so these load as reference
    // values and the engine never selects them for a quantity. The evidence
    // status lives in conditions.status; it is not the same thing as verified.
    const status = statusOf(r.conditions);
    const notes = [
      r.id_source ? `Knowledge base row ${r.id_source}.` : "",
      status ? `Evidence status in the knowledge base: ${status}.` : "",
      "No input_parameter/input_unit/result_unit in the source sheet, so this row is "
        + "reference only and is not used for a quantity calculation.",
    ].filter(Boolean).join(" ");
    return coefficientRow({ ...r, verified: "FALSE", verified_by: "", verified_on: "", notes }, file, { factor });
  });
}

function statusOf(conditions) {
  if (!conditions) return "";
  try {
    return JSON.parse(conditions).status || "";
  } catch {
    return "";
  }
}

/**
 * Schedule VI Part-B notifies a maximum waste water generation per unit of
 * production, per industry. There is no zone and no averaging period, so these
 * rows are told apart by `industry` and carry the production basis in `basis`
 * (both added by migration 006).
 */
function sectorWaterStandards() {
  const file = "collected/sector_water_standards.csv";
  const { records } = read(COLLECTED, "sector_water_standards.csv");
  return records.map((r) => {
    const line = r.__line;
    if (r.limit_type !== "maximum" && r.limit_type !== "minimum") {
      fail(file, line, `limit_type is ${JSON.stringify(r.limit_type)}`);
    }
    return {
      category: "Resource",
      parameter_name: limit(requireText(r.parameter_name, file, line, "parameter_name"), 100, file, line, "parameter_name"),
      display_name: limit(r.display_name, 200, file, line, "display_name") || null,
      standard_name: limit(requireText(r.standard_name, file, line, "standard_name"), 200, file, line, "standard_name"),
      industry: limit(requireText(r.industry, file, line, "industry"), 150, file, line, "industry"),
      zone: "All",
      averaging_period: "Not applicable",
      basis: limit(requireText(r.basis, file, line, "basis"), 150, file, line, "basis"),
      limit_type: r.limit_type,
      limit_value: numberOrFail(r.limit_value, file, line, "limit_value"),
      unit: limit(unit(requireText(r.unit, file, line, "unit")), 50, file, line, "unit"),
      authority: limit(requireText(r.authority, file, line, "authority"), 150, file, line, "authority"),
      reference: r.reference || null,
      effective_from: "1993-05-19",
      effective_to: null,
      active: true,
      notes: r.notes || null,
      ...verification(r, file),
    };
  });
}

// --------------------------------------------------------- regional baseline

const BASELINE_STATUS = {
  COLLECTED: "COLLECTED",
  COLLECTED_SECONDARY: "SECONDARY",
  NOT_COLLECTED: "NOT_COLLECTED",
};

function regionalBaseline() {
  const file = "collected/solapur_baseline.csv";
  const { records } = read(COLLECTED, "solapur_baseline.csv");
  return records.map((r) => {
    const line = r.__line;
    const status = BASELINE_STATUS[r.status];
    if (!status) fail(file, line, `status is ${JSON.stringify(r.status)}`);

    // The CHECK wants 'Natural Hazards'; the sheet writes 'Natural hazards'.
    const module = (r.module || "").replace(/\bhazards\b/, "Hazards");
    if (!BASELINE_MODULES.includes(module)) {
      fail(file, line, `module is ${JSON.stringify(r.module)}`);
    }

    const raw = r.value || "";
    let valueNumeric = null;
    let valueText = null;
    if (raw !== "") {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) valueNumeric = parsed;
      else valueText = raw;
    } else if (status !== "NOT_COLLECTED") {
      fail(file, line, "value is empty but status is not NOT_COLLECTED");
    }

    // An index must never be compared with a regulatory limit.
    const isIndex = /quality index/i.test(r.item || "");

    return {
      module,
      item: limit(requireText(r.item, file, line, "item"), 200, file, line, "item"),
      scope: limit(requireText(r.scope, file, line, "scope"), 200, file, line, "scope"),
      state: "Maharashtra",
      district: "Solapur",
      value_numeric: valueNumeric,
      value_text: valueText,
      unit: limit(r.unit ? unit(r.unit) : "", 50, file, line, "unit") || null,
      qualifier: r.qualifier || null,
      source: status === "NOT_COLLECTED"
        ? null
        : limit(r.source, 200, file, line, "source") || null,
      reference: r.reference || null,
      as_of: limit(r.as_of, 50, file, line, "as_of") || null,
      status,
      is_index: isIndex,
      verified: false,
      verified_by: null,
      verified_on: null,
      notes: null,
    };
  });
}

const BASELINE_MODULES = ["Air", "Water", "Ecology", "Carbon", "Resource", "Waste", "Noise",
  "Meteorology", "Land", "Soil", "Socio-economic", "Natural Hazards"];

// ---------------------------------------------------------- calculation rules

function knowledgeBaseRules() {
  const file = "knowledge_base/calculation_rules.csv";
  const { records } = read(KB, "calculation_rules.csv");
  const rows = [];
  const counters = {};

  for (const r of records) {
    const line = r.__line;
    const module = (r.module || "").toUpperCase();
    const factor = FACTOR_BY_MODULE[module];
    const ruleType = r.rule_type || "";

    if (!factor) {
      skipped.push(`${file}:${line} ${module} "${ruleType}" - the calculation_rules.factor `
        + "CHECK allows only the seven impact factors, and this row is a cross-cutting "
        + "methodology rule");
      continue;
    }

    const formula = r.condition_or_formula
      || [r.value_1, r.value_2].filter(Boolean).join(" to ")
      || "";
    if (!formula) {
      skipped.push(`${file}:${line} ${module} "${ruleType}" - no formula or condition to store, and formula is NOT NULL`);
      continue;
    }

    counters[module] = (counters[module] || 0) + 1;
    const code = `V3_${module}_${String(counters[module]).padStart(3, "0")}`;
    rows.push({
      factor,
      rule_code: limit(code, 50, file, line, "rule_code"),
      rule_name: limit(ruleType || code, 200, file, line, "rule_name"),
      description: [r.classification, r.source_or_note].filter(Boolean).join(" | ") || null,
      formula,
      conditions: JSON.stringify({ module, rule_type: ruleType }),
      thresholds: JSON.stringify({
        value_1: r.value_1 || null,
        value_2: r.value_2 || null,
        unit_or_status: r["unit/status"] || null,
      }),
      weight: null,
      // The whole sheet is Rule Book v3.0. The sheet's own `classification`
      // column holds an evidence label (METHODOLOGY, PROXY, REFERENCE) and in
      // a few rows the columns are shifted, so it goes in description instead.
      methodology_version: "3.0",
      reference: r.source_or_note || null,
      active: true,
    });
  }
  return rows;
}

// ------------------------------------------------------------- data sources

function knowledgeBaseDataSources() {
  const file = "knowledge_base/data_sources.csv";
  const { records } = read(KB, "data_sources.csv");
  return records.map((r) => {
    const line = r.__line;
    return {
      source_key: limit(requireText(r.source_id, file, line, "source_id"), 100, file, line, "source_id"),
      name: limit(requireText(r.source_name, file, line, "source_name"), 150, file, line, "source_name"),
      provider: limit(r.provider, 150, file, line, "provider") || null,
      source_type: limit(r.source_class, 50, file, line, "source_class") || null,
      endpoint: r.url_or_internal_reference || null,
      description: [r.purpose, r.version_or_date ? `Version/date: ${r.version_or_date}` : ""]
        .filter(Boolean).join(" | ") || null,
      active: true,
    };
  });
}

// -------------------------------------------------------------------- write

const STANDARD_COLUMNS = ["category", "parameter_name", "display_name", "standard_name",
  "industry", "zone", "averaging_period", "basis", "limit_type", "limit_value", "unit",
  "authority", "reference", "effective_from", "effective_to", "verified", "verified_by",
  "verified_on", "active", "notes"];

const BASELINE_COLUMNS = ["module", "item", "scope", "state", "district", "value_numeric",
  "value_text", "unit", "qualifier", "source", "reference", "as_of", "status", "is_index",
  "verified", "verified_by", "verified_on", "notes"];

const COEFFICIENT_COLUMNS = ["industry", "factor", "coefficient_code", "coefficient_name",
  "input_parameter", "input_unit", "value", "unit", "result_unit", "source", "reference",
  "methodology_version", "conditions", "effective_from", "effective_to", "active", "verified",
  "verified_by", "verified_on", "notes"];

const RULE_COLUMNS = ["factor", "rule_code", "rule_name", "description", "formula", "conditions",
  "thresholds", "weight", "methodology_version", "reference", "active"];

function placeholders(columns) {
  return columns.map((_, i) => `$${i + 1}`).join(", ");
}

function updateSet(columns, key) {
  return columns.filter((c) => !key.includes(c))
    .map((c) => `${c} = EXCLUDED.${c}`)
    .concat("updated_at = CURRENT_TIMESTAMP")
    .join(", ");
}

async function upsert(client, table, columns, conflict, rows, key) {
  const sql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders(columns)})`
    + ` ON CONFLICT ${conflict} DO UPDATE SET ${updateSet(columns, key)}`
    + " RETURNING (xmax = 0) AS inserted";
  let inserted = 0;
  let updated = 0;
  for (const row of rows) {
    const result = await client.query(sql, columns.map((c) => row[c]));
    if (result.rows[0].inserted) inserted += 1;
    else updated += 1;
  }
  return { inserted, updated };
}

async function upsertDataSources(client, rows) {
  let inserted = 0;
  let updated = 0;
  for (const row of rows) {
    const existing = await client.query("SELECT id FROM data_sources WHERE source_key = $1",
      [row.source_key]);
    if (existing.rowCount) {
      await client.query(
        `UPDATE data_sources SET name = $2, provider = $3, source_type = $4, endpoint = $5,
           description = $6, active = $7, updated_at = CURRENT_TIMESTAMP
         WHERE source_key = $1`,
        [row.source_key, row.name, row.provider, row.source_type, row.endpoint,
          row.description, row.active]);
      updated += 1;
    } else {
      await client.query(
        `INSERT INTO data_sources (source_key, name, provider, source_type, endpoint,
           description, active) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [row.source_key, row.name, row.provider, row.source_type, row.endpoint,
          row.description, row.active]);
      inserted += 1;
    }
  }
  return { inserted, updated };
}

/**
 * Migration 003 seeded NAAQS rows under zone 'All' and under a zone name that
 * drops the notification's trailing "Area". The collected set covers all 12
 * pollutants under both zone names the notification actually uses, so the old
 * rows are deactivated rather than deleted: nothing is lost, and the engine,
 * which reads only active rows, stops seeing two limits for one pollutant.
 */
async function deactivateSupersededNaaqs(client) {
  const result = await client.query(
    `UPDATE regulatory_standards
        SET active = FALSE, updated_at = CURRENT_TIMESTAMP,
            notes = COALESCE(notes || ' | ', '')
                    || 'Superseded by the collected NAAQS rows carrying the notification zone names.'
      WHERE standard_name = 'NAAQS 2009'
        AND zone <> ALL ($1::text[])
        AND active
      RETURNING parameter_name, zone, averaging_period`,
    [NAAQS_ZONES]);
  return result.rows;
}

async function seed() {
  const dryRun = process.argv.includes("--dry-run");
  const validateOnly = process.argv.includes("--validate-only");

  const standards = [...collectedStandards(), ...sectorWaterStandards(),
    ...knowledgeBaseNoiseStandards()];
  const baseline = regionalBaseline();
  const coefficients = [...collectedCoefficients(), ...knowledgeBaseCoefficients()];
  const rules = knowledgeBaseRules();
  const sources = knowledgeBaseDataSources();

  const codes = new Set();
  for (const row of coefficients) {
    if (codes.has(row.coefficient_code)) {
      problems.push(`duplicate coefficient_code across files: ${row.coefficient_code}`);
    }
    codes.add(row.coefficient_code);
  }
  const keys = new Set();
  for (const row of standards) {
    const key = [row.parameter_name, row.standard_name, row.industry, row.zone,
      row.averaging_period, row.limit_type].join("||");
    if (keys.has(key)) problems.push(`duplicate standard key across files: ${key}`);
    keys.add(key);
  }

  if (problems.length) {
    console.error(`Nothing was written. ${problems.length} problem(s):\n`);
    problems.forEach((p) => console.error(`  ${p}`));
    process.exitCode = 1;
    await pool.end();
    return;
  }

  if (validateOnly) {
    console.log("VALIDATE ONLY - the database was not contacted.\n");
    console.log(`  regulatory_standards     ${String(standards.length).padStart(4)} rows ready`);
    console.log(`  engineering_coefficients ${String(coefficients.length).padStart(4)} rows ready`);
    console.log(`  calculation_rules        ${String(rules.length).padStart(4)} rows ready`);
    console.log(`  data_sources             ${String(sources.length).padStart(4)} rows ready`);
    console.log(`  regional_baseline        ${String(baseline.length).padStart(4)} rows ready`);
    console.log(`\n  ${skipped.length} source row(s) would be skipped.`);
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const superseded = await deactivateSupersededNaaqs(client);
    const s = await upsert(client, "regulatory_standards", STANDARD_COLUMNS,
      "ON CONSTRAINT uq_regulatory_standards", standards,
      ["parameter_name", "standard_name", "industry", "zone", "averaging_period", "limit_type"]);
    const c = await upsert(client, "engineering_coefficients", COEFFICIENT_COLUMNS,
      "(coefficient_code)", coefficients, ["coefficient_code"]);
    const r = await upsert(client, "calculation_rules", RULE_COLUMNS,
      "(rule_code)", rules, ["rule_code"]);
    const d = await upsertDataSources(client, sources);
    const b = await upsert(client, "regional_baseline", BASELINE_COLUMNS,
      "ON CONSTRAINT uq_regional_baseline", baseline, ["module", "item", "scope", "as_of"]);

    if (dryRun) {
      await client.query("ROLLBACK");
      console.log("DRY RUN - rolled back, nothing was written.\n");
    } else {
      await client.query("COMMIT");
      console.log("Committed.\n");
    }

    const report = (label, counts) =>
      console.log(`  ${label.padEnd(24)} ${String(counts.inserted).padStart(4)} inserted, `
        + `${String(counts.updated).padStart(4)} updated`);
    report("regulatory_standards", s);
    report("engineering_coefficients", c);
    report("calculation_rules", r);
    report("data_sources", d);
    report("regional_baseline", b);

    if (superseded.length) {
      console.log(`\n  ${superseded.length} superseded NAAQS row(s) deactivated:`);
      superseded.forEach((row) =>
        console.log(`    ${row.parameter_name} ${row.averaging_period} zone "${row.zone}"`));
    }
    if (skipped.length) {
      console.log(`\n  ${skipped.length} source row(s) skipped, with reasons:`);
      skipped.forEach((entry) => console.log(`    ${entry}`));
    }
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`Seeding failed, rolled back: ${err.message}`);
    if (err.detail) console.error(`  detail: ${err.detail}`);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
