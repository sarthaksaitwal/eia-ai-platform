const test = require("node:test");
const assert = require("node:assert");
const {
  findDestructive,
  withoutComments,
  readMigrations,
} = require("../src/db/migrate");

// The guarantee these tests defend: a migration runs against a database that
// already holds collected reference data and real assessments, so no migration
// may ever delete anything. src/db/drop_all.sql is the only file allowed to,
// and it is not in migrations/.

test("no migration contains a statement that destroys data", () => {
  const found = findDestructive(readMigrations());
  assert.deepStrictEqual(
    found,
    [],
    `destructive statements found: ${found
      .map((f) => `${f.filename} (${f.label})`)
      .join(", ")}`
  );
});

test("every migration can be applied twice", () => {
  // Re-running is what keeps a half-applied or unrecorded migration
  // recoverable, so each file has to create conditionally.
  const offenders = [];
  for (const { filename, sql } of readMigrations()) {
    const body = withoutComments(sql);
    const bareTable = /\bCREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)/i.exec(body);
    const bareIndex = /\bCREATE\s+INDEX\s+(?!IF\s+NOT\s+EXISTS)/i.exec(body);
    const bareInsert = /\bINSERT\s+INTO\b/i.test(body) &&
      !/\bON\s+CONFLICT\b/i.test(body);
    if (bareTable) offenders.push(`${filename}: CREATE TABLE without IF NOT EXISTS`);
    if (bareIndex) offenders.push(`${filename}: CREATE INDEX without IF NOT EXISTS`);
    if (bareInsert) offenders.push(`${filename}: INSERT without ON CONFLICT`);
  }
  assert.deepStrictEqual(offenders, [], offenders.join("; "));
});

test("every CREATE TRIGGER is preceded by a DROP TRIGGER IF EXISTS", () => {
  // PostgreSQL has no CREATE TRIGGER IF NOT EXISTS, so an unguarded one
  // fails on the second run. Dropping a trigger destroys no rows.
  const offenders = [];
  for (const { filename, sql } of readMigrations()) {
    const body = withoutComments(sql);
    const created = [...body.matchAll(/\bCREATE\s+TRIGGER\s+(\w+)/gi)].map(
      (m) => m[1]
    );
    const dropped = new Set(
      [...body.matchAll(/\bDROP\s+TRIGGER\s+IF\s+EXISTS\s+(\w+)/gi)].map(
        (m) => m[1]
      )
    );
    for (const name of created) {
      if (!dropped.has(name)) offenders.push(`${filename}: ${name}`);
    }
  }
  assert.deepStrictEqual(offenders, [], offenders.join("; "));
});

test("the tripwire reads statements, not comments that mention them", () => {
  const comment = [
    { filename: "x.sql", sql: "-- the DROP TABLE statements moved out\nSELECT 1;" },
  ];
  assert.deepStrictEqual(findDestructive(comment), []);

  const real = [{ filename: "y.sql", sql: "DROP TABLE projects CASCADE;" }];
  assert.deepStrictEqual(findDestructive(real), [
    { filename: "y.sql", label: "DROP TABLE" },
  ]);
});
