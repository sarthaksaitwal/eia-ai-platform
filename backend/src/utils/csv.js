// Minimal RFC 4180 CSV reader: quoted fields, embedded commas, newlines and
// escaped quotes. Returns one object per data row, keyed by the header.

function parseCsv(text) {
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  let i = 0;

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    if (row.length > 1 || row[0] !== "") rows.push(row);
    row = [];
  };

  while (i < body.length) {
    const ch = body[i];

    if (quoted) {
      if (ch === '"') {
        if (body[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      quoted = true;
      i += 1;
    } else if (ch === ",") {
      endField();
      i += 1;
    } else if (ch === "\r") {
      i += 1;
    } else if (ch === "\n") {
      endRow();
      i += 1;
    } else {
      field += ch;
      i += 1;
    }
  }
  if (field !== "" || row.length) endRow();

  if (!rows.length) return { header: [], records: [] };

  const header = rows[0].map((h) => h.trim());
  const records = rows.slice(1).map((values, index) => {
    const record = { __line: index + 2 };
    header.forEach((name, column) => {
      record[name] = (values[column] ?? "").trim();
    });
    return record;
  });
  return { header, records };
}

module.exports = { parseCsv };
