// Formatting helpers shared by every screen.
//
// node-pg hands back NUMERIC columns as strings so no precision is lost on the
// way out of Postgres. That is the right call, and it means the UI has to be
// deliberate about turning them into text: Number() on a string that is not a
// number gives NaN, and "NaN" on screen looks like a bug in the data rather
// than a gap in it.

/** A count, grouped so four digits and five digits are distinguishable. */
export function formatCount(value: number) {
  return value.toLocaleString();
}

/**
 * A measured or reference value. Accepts the string a NUMERIC column produces
 * and the number a DOUBLE PRECISION column produces. Returns null when there
 * is nothing to show, so the caller decides what a gap looks like rather than
 * getting a stray dash.
 */
export function formatValue(
  value: string | number | null | undefined,
  maximumFractionDigits = 4
) {
  if (value === null || value === undefined || value === "") return null;

  const asNumber = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(asNumber)) return null;

  return asNumber.toLocaleString(undefined, { maximumFractionDigits });
}

/** A value with its unit, or null when either side is missing. */
export function formatMeasure(
  value: string | number | null | undefined,
  unit: string | null | undefined
) {
  const formatted = formatValue(value);
  if (formatted === null) return null;
  return unit ? `${formatted} ${unit}` : formatted;
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Coordinates, at the ~1 m precision six decimals gives. */
export function formatCoords(
  latitude: number | string | null | undefined,
  longitude: number | string | null | undefined
) {
  const lat = formatValue(latitude, 6);
  const lon = formatValue(longitude, 6);
  if (lat === null || lon === null) return null;
  return `${lat}, ${lon}`;
}

/** Initials for an avatar, from a name of any shape. */
export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
