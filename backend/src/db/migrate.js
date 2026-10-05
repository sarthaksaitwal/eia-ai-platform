require("dotenv").config();
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { pool } = require("../config/db");

const MIGRATIONS_DIR = path.join(__dirname, "migrations");
const DROP_ALL_FILE = path.join(__dirname, "drop_all.sql");

// A migration that is already recorded is never run again, so nothing in
// migrations/ may destroy data even once. These patterns are a tripwire for
// a statement that would: the runner stops and names the file rather than
// applying it. Use migrate:reset to rebuild the database instead.
const DESTRUCTIVE_PATTERNS = [
  { label: "DROP TABLE", re: /\bDROP\s+TABLE\b/i },
  { label: "DROP DATABASE", re: /\bDROP\s+DATABASE\b/i },
  { label: "DROP SCHEMA", re: /\bDROP\s+SCHEMA\b/i },
  { label: "TRUNCATE", re: /\bTRUNCATE\b/i },
  { label: "DELETE FROM", re: /\bDELETE\s+FROM\b/i },
  { label: "DROP COLUMN", re: /\bDROP\s+COLUMN\b/i },
];

// Comments carry words like "DROP TABLE" when they explain why something
// moved out of a file, so strip them before the tripwire looks.
function withoutComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");
}

function checksum(sql) {
  return crypto.createHash("sha256").update(sql).digest("hex").slice(0, 16);
}

function readMigrations() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((filename) => {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, filename), "utf8");
      return { filename, sql, checksum: checksum(sql) };
    });
}

function findDestructive(migrations) {
  const found = [];
  for (const migration of migrations) {
    const body = withoutComments(migration.sql);
    for (const { label, re } of DESTRUCTIVE_PATTERNS) {
      if (re.test(body)) found.push({ filename: migration.filename, label });
    }
  }
  return found;
}

async function ensureLedger(client) {
  // Named so it reads the same as the table the rest of the schema uses.
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
        filename    VARCHAR(255) PRIMARY KEY,
        checksum    VARCHAR(64)  NOT NULL,
        applied_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function tableExists(client, name) {
  const { rows } = await client.query("SELECT to_regclass($1) AS oid", [
    `public.${name}`,
  ]);
  return rows[0].oid !== null;
}

async function readLedger(client) {
  const { rows } = await client.query(
    "SELECT filename, checksum FROM schema_migrations"
  );
  return new Map(rows.map((row) => [row.filename, row.checksum]));
}

// Each migration gets its own transaction. A failure rolls that file back and
// leaves every earlier file applied and recorded, so a fixed migration can be
// re-run without redoing the ones that worked.
async function apply(client, migration) {
  await client.query("BEGIN");
  try {
    await client.query(migration.sql);
    await client.query(
      `INSERT INTO schema_migrations (filename, checksum)
       VALUES ($1, $2)
       ON CONFLICT (filename)
       DO UPDATE SET checksum = EXCLUDED.checksum,
                     applied_at = CURRENT_TIMESTAMP`,
      [migration.filename, migration.checksum]
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

async function resetDatabase(client) {
  const sql = fs.readFileSync(DROP_ALL_FILE, "utf8");
  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const reset = args.includes("--reset");
  const confirmed = args.includes("--yes");
  const dryRun = args.includes("--dry-run");

  if (reset && !confirmed) {
    console.error("");
    console.error("  migrate:reset DROPS EVERY TABLE AND EVERY ROW.");
    console.error("");
    console.error("  That includes the seeded reference data: regulatory");
    console.error("  standards, engineering coefficients, calculation rules,");
    console.error("  the Solapur baseline, and every project, assessment and");
    console.error("  user in this database.");
    console.error("");
    console.error("  Re-run with --yes if that is what you want:");
    console.error("");
    console.error("      npm run migrate:reset -- --yes");
    console.error("");
    console.error("  Afterwards you must re-run: npm run seed:reference");
    console.error("");
    process.exitCode = 1;
    return;
  }

  const migrations = readMigrations();
  if (!migrations.length) {
    console.error(`No .sql files found in ${MIGRATIONS_DIR}`);
    process.exitCode = 1;
    return;
  }

  const destructive = findDestructive(migrations);
  if (destructive.length) {
    console.error("");
    console.error("  A migration contains a statement that destroys data:");
    console.error("");
    for (const { filename, label } of destructive) {
      console.error(`      ${filename}  contains  ${label}`);
    }
    console.error("");
    console.error("  Migrations run against databases that hold real rows, so");
    console.error("  they must only add and alter. Move the statement into");
    console.error("  src/db/drop_all.sql, which runs from migrate:reset only.");
    console.error("");
    process.exitCode = 1;
    return;
  }

  const client = await pool.connect();
  try {
    if (reset) {
      console.log("Dropping every table (migrate:reset --yes).");
      await resetDatabase(client);
      console.log("  dropped");
    }

    const hadLedger = await tableExists(client, "schema_migrations");

    // --dry-run reports and writes nothing at all, so it must not create the
    // ledger either. Without one, every migration simply counts as pending.
    if (!dryRun) await ensureLedger(client);

    if (!hadLedger && (await tableExists(client, "users"))) {
      console.log("");
      console.log("  This database predates the migration ledger.");
      console.log("  Every migration is idempotent, so each one is applied");
      console.log("  once to record it. Existing rows are not touched.");
      console.log("");
    }

    const applied =
      hadLedger || !dryRun ? await readLedger(client) : new Map();

    const pending = migrations.filter((m) => !applied.has(m.filename));
    const changed = migrations.filter(
      (m) => applied.has(m.filename) && applied.get(m.filename) !== m.checksum
    );

    for (const migration of changed) {
      console.log(
        `  note: ${migration.filename} was edited after it was applied; not re-run`
      );
    }

    if (!pending.length) {
      console.log(
        `Up to date: ${applied.size} migration(s) already applied, nothing to do.`
      );
      return;
    }

    if (dryRun) {
      console.log("Would apply:");
      for (const migration of pending) console.log(`  ${migration.filename}`);
      console.log("\n--dry-run: nothing was applied.");
      return;
    }

    for (const migration of pending) {
      process.stdout.write(`Applying ${migration.filename} ... `);
      await apply(client, migration);
      console.log("done");
    }

    console.log(
      `\n${pending.length} migration(s) applied, ${applied.size} already up to date.`
    );
  } catch (err) {
    console.error(`\nMigration failed: ${err.message}`);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run only when invoked as a script, so the tests can require the helpers
// without opening a connection.
if (require.main === module) {
  main();
}

module.exports = {
  findDestructive,
  withoutComments,
  checksum,
  readMigrations,
  DESTRUCTIVE_PATTERNS,
};
