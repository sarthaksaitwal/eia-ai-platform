/**
 * Unsaved input edits, kept in the browser so a refresh or a trip to another
 * page does not throw away a half-filled form.
 *
 * What is stored is the *difference* from what the server already holds, not
 * the whole form. The server stays the source of truth: when the page loads
 * it seeds every field from /values and then lays these edits on top. Storing
 * the whole form instead would mean a value saved in another tab, or by
 * someone else on a shared database, is hidden behind a stale local copy
 * until the user happens to retype it.
 *
 * Every access is wrapped. localStorage throws rather than returning null in
 * a private window and when site data is blocked, and this is a convenience,
 * so it must never be the reason the page fails to render.
 */

/** One field, mid-edit. Mirrors the Draft shape in pages/Inputs.tsx. */
export interface DraftField {
  value: string;
  unavailable: boolean;
}

export interface InputDraft {
  fields: Record<string, DraftField>;
  period: string;
  /** When it was last written, for the "restored" notice. */
  savedAt: string;
}

// Bumped if the shape ever changes, so an old payload is discarded rather
// than half-read into a form.
const VERSION = 1;

function key(assessmentId: string): string {
  return `eia:input-draft:v${VERSION}:${assessmentId}`;
}

export function loadDraft(assessmentId: string): InputDraft | null {
  try {
    const raw = window.localStorage.getItem(key(assessmentId));
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;

    const { fields, period, savedAt } = parsed as Partial<InputDraft>;
    if (typeof fields !== "object" || fields === null) return null;

    // Anything that is not the expected shape is dropped field by field
    // rather than failing the whole restore: a single bad entry should not
    // cost the user the rest of what they typed.
    const clean: Record<string, DraftField> = {};
    for (const [code, field] of Object.entries(fields)) {
      if (typeof field !== "object" || field === null) continue;
      const { value, unavailable } = field as Partial<DraftField>;
      if (typeof value !== "string") continue;
      clean[code] = { value, unavailable: unavailable === true };
    }

    const periodValue = typeof period === "string" ? period : "";

    // A changed reporting period with no changed field is still unsaved work,
    // so emptiness has to be judged on both.
    if (!Object.keys(clean).length && !periodValue) return null;

    return {
      fields: clean,
      period: periodValue,
      savedAt: typeof savedAt === "string" ? savedAt : "",
    };
  } catch {
    return null;
  }
}

/**
 * Writes the edits that differ from `baseline`. Passing nothing that differs
 * removes the entry, so a form edited back to its saved state stops
 * announcing itself as having unsaved work.
 */
export function saveDraft(
  assessmentId: string,
  fields: Record<string, DraftField>,
  baseline: Record<string, DraftField>,
  period: string,
  baselinePeriod: string
): void {
  try {
    const diff: Record<string, DraftField> = {};
    for (const [code, field] of Object.entries(fields)) {
      const before = baseline[code];
      const unchanged = before
        ? before.value === field.value && before.unavailable === field.unavailable
        : field.value === "" && !field.unavailable;
      if (!unchanged) diff[code] = field;
    }

    const periodChanged = period !== baselinePeriod;

    if (!Object.keys(diff).length && !periodChanged) {
      clearDraft(assessmentId);
      return;
    }

    const payload: InputDraft = {
      fields: diff,
      period,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(key(assessmentId), JSON.stringify(payload));
  } catch {
    // Out of quota, or storage denied. The form still works; only the
    // refresh-survives-it part is lost, which is what this whole module is.
  }
}

export function clearDraft(assessmentId: string): void {
  try {
    window.localStorage.removeItem(key(assessmentId));
  } catch {
    // Nothing to do: see saveDraft.
  }
}
