/**
 * Seeds the module-driven calculation tables from the definitions under
 * src/db/seeds/modules/.
 *
 *   npm run seed:modules -- [--dry-run]
 *
 * Every file in that directory is one module: its registry row, the questions
 * it asks, the constants it multiplies by, the published limits it compares
 * against, and the outputs it produces. Adding a module is adding a file, and
 * this runner discovers it without being edited.
 *
 * Nothing is written until every definition has passed validation, and the
 * write is one transaction. Re-running updates rows in place.
 *
 * The validation is the point of this file. It refuses to seed a constant
 * whose expected input unit does not match the unit of the question it
 * applies to, which is the mistake that made most of the old
 * engineering_coefficients unusable: twelve rows expected tonnes of diesel
 * while the only diesel question asked for kilolitres, and nothing noticed
 * until the engine tried to multiply them.
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { pool } = require("../config/db");

const MODULES_DIR = path.join(__dirname, "seeds", "modules");

// The only unit conversions the engine performs. Both are stated explicitly
// in the specification ("MWh = kWh / 1,000", "convert kg to tonnes by
// dividing by 1,000"), and nothing else is converted: a mismatch the engine
// cannot resolve from this table stops the calculation instead of guessing a
// density or a calorific value.
//
// Kept in step with ENGINE_CONVERSIONS in
// analytics-service/app/calculations/units.py. Two entries in two places is
// safer here than a shared endpoint the seeder would have to call.
const CONVERSIONS = {
  "kWh/year->MWh/year": 0.001,
  "kg/year->t/year": 0.001,
};

const problems = [];

function fail(where, message) {
  problems.push(`${where}: ${message}`);
}

// ------------------------------------------------------------------ loading

function loadDefinitions() {
  const files = fs
    .readdirSync(MODULES_DIR)
    .filter((name) => name.endsWith(".js"))
    .sort();

  const definitions = [];
  for (const filename of files) {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const def = require(path.join(MODULES_DIR, filename));
    definitions.push({ filename, ...def });
  }
  return definitions;
}

// --------------------------------------------------------------- validation

function validate(definitions) {
  // Parameter and output codes are globally unique, not unique per module,
  // so a shared quantity is one question. That makes a collision between two
  // modules a real error rather than a namespacing detail.
  const parameters = new Map();
  const outputs = new Map();
  const moduleCodes = new Set();

  for (const def of definitions) {
    const where = def.filename;

    if (!def.module || !def.module.code) {
      fail(where, "exports no module.code");
      continue;
    }
    const moduleCode = def.module.code;
    if (moduleCodes.has(moduleCode)) {
      fail(where, `module code "${moduleCode}" is already defined elsewhere`);
    }
    moduleCodes.add(moduleCode);

    for (const p of def.parameters ?? []) {
      if (parameters.has(p.code)) {
        const other = parameters.get(p.code);
        fail(where, `parameter "${p.code}" is already declared by ${other.module}`);
        continue;
      }
      parameters.set(p.code, { ...p, module: moduleCode });
    }

    for (const o of def.outputs ?? []) {
      if (outputs.has(o.code)) {
        fail(where, `output "${o.code}" is already declared`);
        continue;
      }
      outputs.set(o.code, { ...o, module: moduleCode });
    }
  }

  // Second pass: cross-references can only be checked once every module has
  // contributed its parameters and outputs, because a module may legitimately
  // reference a parameter another module owns.
  for (const def of definitions) {
    const where = def.filename;

    for (const c of def.constants ?? []) {
      const target = parameters.get(c.applies_to);
      if (!target) {
        fail(where, `constant "${c.code}" applies to "${c.applies_to}", `
          + "which no module declares as a parameter");
        continue;
      }
      if (target.unit !== c.expects_unit) {
        const key = `${target.unit}->${c.expects_unit}`;
        if (!(key in CONVERSIONS)) {
          fail(where, `constant "${c.code}" expects "${c.applies_to}" in `
            + `${c.expects_unit}, but that question is asked in ${target.unit}, `
            + "and no conversion between them is defined");
        }
      }
    }

    for (const l of def.limits ?? []) {
      if (!parameters.has(l.subject) && !outputs.has(l.subject)) {
        fail(where, `limit "${l.code}" has subject "${l.subject}", `
          + "which is neither a parameter nor an output");
      }
    }
  }

  return { parameters, outputs };
}

// ------------------------------------------------------------------ writing

function placeholders(columns) {
  return columns.map((_, i) => `$${i + 1}`).join(", ");
}

function updateSet(columns, key) {
  return columns
    .filter((c) => c !== key)
    .map((c) => `${c} = EXCLUDED.${c}`)
    .concat("updated_at = CURRENT_TIMESTAMP")
    .join(", ");
}

async function upsert(client, table, columns, key, rows) {
  const sql = `INSERT INTO ${table} (${columns.join(", ")})`
    + ` VALUES (${placeholders(columns)})`
    + ` ON CONFLICT (${key}) DO UPDATE SET ${updateSet(columns, key)}`
    + " RETURNING (xmax = 0) AS inserted";

  let inserted = 0;
  let updated = 0;
  for (const row of rows) {
    const result = await client.query(sql, columns.map((c) => row[c] ?? null));
    if (result.rows[0].inserted) inserted += 1;
    else updated += 1;
  }
  return { inserted, updated };
}

const MODULE_COLUMNS = ["code", "name", "description", "purpose",
  "display_order", "enabled"];

const PARAMETER_COLUMNS = ["module_code", "code", "label", "unit", "value_type",
  "enum_values", "help_text", "required", "display_order", "active"];

const CONSTANT_COLUMNS = ["module_code", "code", "label", "value", "unit",
  "applies_to", "expects_unit", "result_unit", "tags", "source", "citation",
  "source_url", "version", "retrieved_on", "verified", "notes", "active"];

const LIMIT_COLUMNS = ["module_code", "code", "label", "subject", "selector",
  "comparison", "value", "value_max", "unit", "is_index", "source", "citation",
  "source_url", "version", "effective_from", "verified", "notes", "active"];

const OUTPUT_COLUMNS = ["module_code", "code", "label", "unit", "formula_text",
  "operation", "comparable", "limitation_note", "display_order", "active"];

// JSONB columns need a string. `active` and `verified` are defaulted here
// rather than left out: the INSERT names every column, so an absent key
// would send an explicit NULL and both columns are NOT NULL. `verified` is
// false unless a definition says otherwise, which is the safe direction -- a
// value nobody has checked must not claim to have been checked.
function row(moduleCode, source, jsonColumns = []) {
  const out = { module_code: moduleCode, active: true, verified: false, ...source };
  for (const column of jsonColumns) {
    if (out[column] !== undefined && out[column] !== null) {
      out[column] = JSON.stringify(out[column]);
    }
  }
  return out;
}

async function seed() {
  const dryRun = process.argv.includes("--dry-run");
  const definitions = loadDefinitions();

  if (!definitions.length) {
    console.error(`No module definitions found in ${MODULES_DIR}`);
    process.exitCode = 1;
    await pool.end();
    return;
  }

  const { parameters, outputs } = validate(definitions);

  console.log(`\n${definitions.length} module definition(s) loaded:\n`);
  for (const def of definitions) {
    console.log(`  ${def.module.code.padEnd(10)} `
      + `${String(def.parameters?.length ?? 0).padStart(3)} parameters, `
      + `${String(def.constants?.length ?? 0).padStart(3)} constants, `
      + `${String(def.limits?.length ?? 0).padStart(3)} limits, `
      + `${String(def.outputs?.length ?? 0).padStart(3)} outputs`
      + (def.module.enabled === false ? "   [disabled]" : ""));
  }
  console.log(`\n  ${parameters.size} parameters and ${outputs.size} outputs in total.`);

  if (problems.length) {
    console.error(`\n${problems.length} problem(s) found, nothing written:\n`);
    problems.forEach((p) => console.error(`  ${p}`));
    process.exitCode = 1;
    await pool.end();
    return;
  }

  if (dryRun) {
    console.log("\n--dry-run: validated, nothing written.\n");
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const counts = {};
    const add = (label, result) => {
      const existing = counts[label] ?? { inserted: 0, updated: 0 };
      counts[label] = {
        inserted: existing.inserted + result.inserted,
        updated: existing.updated + result.updated,
      };
    };

    // Modules first: every other table references them by foreign key.
    add("modules", await upsert(client, "modules", MODULE_COLUMNS, "code",
      definitions.map((d) => ({ ...d.module }))));

    // Then parameters, because module_constants.applies_to points at them
    // and module_results reports against them.
    for (const def of definitions) {
      const code = def.module.code;
      add("module_parameters", await upsert(client, "module_parameters",
        PARAMETER_COLUMNS, "code",
        (def.parameters ?? []).map((p) => row(code, p, ["enum_values"]))));
    }

    for (const def of definitions) {
      const code = def.module.code;
      add("module_constants", await upsert(client, "module_constants",
        CONSTANT_COLUMNS, "code",
        (def.constants ?? []).map((c) => row(code, c, ["tags"]))));

      add("module_limits", await upsert(client, "module_limits",
        LIMIT_COLUMNS, "code",
        (def.limits ?? []).map((l) => row(code, l, ["selector"]))));

      add("module_outputs", await upsert(client, "module_outputs",
        OUTPUT_COLUMNS, "code",
        (def.outputs ?? []).map((o) => row(code, o))));
    }

    await client.query("COMMIT");

    console.log("\nWritten:\n");
    for (const [label, c] of Object.entries(counts)) {
      console.log(`  ${label.padEnd(20)} ${String(c.inserted).padStart(4)} inserted, `
        + `${String(c.updated).padStart(4)} updated`);
    }
    console.log("");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`\nSeeding failed, rolled back: ${err.message}`);
    if (err.detail) console.error(`  detail: ${err.detail}`);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
