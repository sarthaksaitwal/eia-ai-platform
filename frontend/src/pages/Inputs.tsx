import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Calculator, Info, Save, SlidersHorizontal } from "lucide-react";

import { Empty, ErrorState, InlineError, Loading } from "../components/ui/States";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Note,
  PageHeader,
} from "../components/ui/Primitives";
import { inputClass, selectClass } from "../components/ui/fieldStyles";
import { api } from "../lib/api";
import { useApi } from "../lib/useApi";
import { useLatestAssessment } from "../lib/useAssessment";
import { formatCount } from "../lib/format";
import { clearDraft, loadDraft, saveDraft } from "../lib/inputDrafts";
import type { ModuleParameter, NewParameterValue } from "../lib/types";

/** What one field holds while it is being edited. */
interface Draft {
  value: string;
  unavailable: boolean;
}

const EMPTY: Draft = { value: "", unavailable: false };

export default function Inputs() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const project = useApi(
    () => (projectId ? api.getProject(projectId) : Promise.reject(new Error("No project."))),
    [projectId]
  );
  const { assessment, loading: assessmentLoading, create, creating, createError } =
    useLatestAssessment(projectId);

  const modules = useApi(() => api.listModules(), []);
  const stored = useApi(
    () =>
      assessment
        ? api.listValues(assessment.id)
        : Promise.resolve({ values: [] }),
    [assessment?.id]
  );

  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [period, setPeriod] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [restored, setRestored] = useState(false);

  // The id alone, so the effects below re-run when the assessment changes
  // rather than whenever a refetch hands back an equal-but-new object.
  const assessmentId = assessment?.id;

  // Seeds the form from what is already stored. A stored value of null with
  // status UNAVAILABLE is a real answer and comes back as a ticked box, not
  // as an empty field: the difference between "not answered" and "cannot be
  // answered" is what decides whether a result is missing an input.
  const baseline = useMemo(() => {
    const map: Record<string, Draft> = {};
    for (const value of stored.data?.values ?? []) {
      map[value.parameter_code] = {
        value: value.value_numeric ?? value.value_text ?? "",
        unavailable: value.source_status === "UNAVAILABLE",
      };
    }
    return map;
  }, [stored.data]);

  // The reporting period as stored, kept apart from the edited one so a
  // change to it is recognised as a change.
  const basePeriod = useMemo(() => {
    const first = (stored.data?.values ?? []).find((v) => v.reporting_period);
    return first?.reporting_period ?? "";
  }, [stored.data]);

  // Seeds the form from what is stored, then lays any unsaved local edits on
  // top. This also runs after a save, by which point the draft has been
  // cleared and the server's values are the whole answer.
  useEffect(() => {
    const draft = assessmentId ? loadDraft(assessmentId) : null;
    setDrafts(draft ? { ...baseline, ...draft.fields } : baseline);
    setPeriod(draft && draft.period ? draft.period : basePeriod);
    setRestored(Boolean(draft));
  }, [assessmentId, baseline, basePeriod]);

  // Holds the unsaved edits so a refresh or a trip to another page does not
  // lose them. Writing on every change rather than on unload is deliberate:
  // beforeunload does not fire reliably when a mobile browser discards a
  // backgrounded tab, and the payload here is a few hundred bytes.
  //
  // Waits for the stored values to arrive. Before that the baseline is empty,
  // and a diff taken against it would record the server's own values as
  // though the user had just typed them.
  useEffect(() => {
    if (!assessmentId || stored.loading) return;
    saveDraft(assessmentId, drafts, baseline, period, basePeriod);
  }, [assessmentId, drafts, baseline, period, basePeriod, stored.loading]);

  const set = useCallback((code: string, patch: Partial<Draft>) => {
    setDrafts((current) => ({
      ...current,
      [code]: { ...(current[code] ?? EMPTY), ...patch },
    }));
    setSavedAt(null);
  }, []);

  const moduleRows = modules.data?.modules ?? [];

  // Only what the user actually changed is sent. Re-sending every field on
  // each save would overwrite the source status and evidence recorded
  // against answers nobody touched.
  const changed = useMemo(() => {
    const out: NewParameterValue[] = [];
    const parameters = new Map<string, ModuleParameter>();
    for (const module of moduleRows) {
      for (const parameter of module.parameters) parameters.set(parameter.code, parameter);
    }

    for (const [code, draft] of Object.entries(drafts)) {
      const parameter = parameters.get(code);
      if (!parameter) continue;

      const before = baseline[code] ?? EMPTY;
      const periodChanged =
        (stored.data?.values ?? []).some(
          (v) => v.parameter_code === code && (v.reporting_period ?? "") !== period
        );
      if (draft.value === before.value && draft.unavailable === before.unavailable
          && !periodChanged) {
        continue;
      }

      if (draft.unavailable) {
        out.push({
          parameterCode: code,
          valueNumeric: null,
          valueText: null,
          sourceStatus: "UNAVAILABLE",
          reportingPeriod: period || null,
        });
        continue;
      }

      if (draft.value.trim() === "") continue;

      if (parameter.value_type === "numeric") {
        const parsed = Number(draft.value);
        if (!Number.isFinite(parsed)) continue;
        out.push({
          parameterCode: code,
          valueNumeric: parsed,
          unit: parameter.unit,
          sourceStatus: "USER_REPORTED",
          reportingPeriod: period || null,
        });
      } else {
        out.push({
          parameterCode: code,
          valueText: draft.value,
          sourceStatus: "USER_REPORTED",
          reportingPeriod: period || null,
        });
      }
    }
    return out;
  }, [drafts, baseline, moduleRows, period, stored.data]);

  const answeredIn = useCallback(
    (parameters: ModuleParameter[]) =>
      parameters.filter((p) => {
        const draft = drafts[p.code];
        return draft && (draft.unavailable || draft.value.trim() !== "");
      }).length,
    [drafts]
  );

  const save = useCallback(async () => {
    if (!assessment || !changed.length) return;
    setSaving(true);
    setSaveError(null);
    try {
      await api.saveValues(assessment.id, changed);
      // Only once the server has them. Clearing before the call would lose
      // the user's work if the request failed.
      clearDraft(assessment.id);
      setRestored(false);
      stored.reload();
      setSavedAt(new Date().toLocaleTimeString());
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }, [assessment, changed, stored]);

  const saveAndCalculate = useCallback(async () => {
    if (!assessment) return;
    setCalculating(true);
    setSaveError(null);
    try {
      if (changed.length) await api.saveValues(assessment.id, changed);
      clearDraft(assessment.id);
      setRestored(false);
      await api.runCalculation(assessment.id);
      navigate(`/projects/${projectId}/results`);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not calculate.");
      setCalculating(false);
    }
  }, [assessment, changed, navigate, projectId]);

  const busy = saving || calculating;

  if (project.loading || assessmentLoading || modules.loading) {
    return <Loading label="Loading the questions..." />;
  }

  if (modules.error) {
    return <ErrorState message={modules.error} onRetry={modules.reload} />;
  }

  return (
    <div>
      <PageHeader
        eyebrow={project.data?.project.name ?? "Project"}
        title="Project inputs"
        hint="The quantities the modules calculate from. Leave anything you cannot supply blank, or mark it unavailable."
        action={
          <Link
            to={`/projects/${projectId}/results`}
            className="text-xs font-semibold text-brand transition-colors duration-200 hover:text-brand-hover"
          >
            View results
          </Link>
        }
      />

      {!assessment && (
        <Card>
          <Empty
            title="No assessment started"
            hint="Inputs and results belong to an assessment, not to the project itself. Start one to begin entering figures."
            action={
              <Button onClick={create} busy={creating}>
                Start an assessment
              </Button>
            }
          />
          {createError && (
            <div className="px-5 pb-5">
              <InlineError message={createError} />
            </div>
          )}
        </Card>
      )}

      {assessment && (
        <>
          <div className="mb-5">
            <Note tone="neutral" icon={Info} title="Nothing here is assumed">
              A figure you leave out is reported as missing, never as zero. Where a
              calculation needs something you have not entered, the result says which
              figure it is waiting for.
            </Note>
          </div>

          <Card className="mb-5">
            <CardHeader
              title="Reporting period"
              hint="Applied to every figure you save. A ratio built from two different periods is meaningless, so the period is recorded once."
            />
            <div className="max-w-sm p-5 pt-0">
              <Field
                label="Period these figures cover"
                htmlFor="reporting-period"
                hint="For example FY 2024-25, or calendar 2025."
              >
                <input
                  id="reporting-period"
                  className={inputClass}
                  value={period}
                  onChange={(event) => setPeriod(event.target.value)}
                  placeholder="FY 2024-25"
                  disabled={busy}
                />
              </Field>
            </div>
          </Card>

          <div className="space-y-5">
            {moduleRows.map((module) => {
              const answered = answeredIn(module.parameters);

              return (
                <Card key={module.code}>
                  <CardHeader
                    title={module.name}
                    hint={module.purpose ?? undefined}
                    action={
                      <Badge tone={answered ? "ok" : "neutral"} icon={SlidersHorizontal}>
                        {formatCount(answered)} of {formatCount(module.parameters.length)}
                      </Badge>
                    }
                  />

                  <div className="grid grid-cols-1 gap-x-5 gap-y-4 p-5 pt-0 md:grid-cols-2 xl:grid-cols-3">
                    {module.parameters.map((parameter) => {
                      const draft = drafts[parameter.code] ?? EMPTY;
                      const fieldId = `p-${parameter.code}`;

                      return (
                        <div key={parameter.code} className="min-w-0">
                          <Field
                            label={
                              parameter.unit
                                ? `${parameter.label} (${parameter.unit})`
                                : parameter.label
                            }
                            htmlFor={fieldId}
                            required={parameter.required}
                            hint={parameter.help_text ?? undefined}
                          >
                            {parameter.value_type === "enum" ? (
                              <select
                                id={fieldId}
                                className={selectClass}
                                value={draft.value}
                                onChange={(event) =>
                                  set(parameter.code, { value: event.target.value })
                                }
                                disabled={busy || draft.unavailable}
                              >
                                <option value="">Not selected</option>
                                {(parameter.enum_values ?? []).map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                id={fieldId}
                                className={inputClass}
                                type={parameter.value_type === "numeric" ? "number" : "text"}
                                inputMode={
                                  parameter.value_type === "numeric" ? "decimal" : undefined
                                }
                                step="any"
                                min={parameter.value_type === "numeric" ? "0" : undefined}
                                value={draft.value}
                                onChange={(event) =>
                                  set(parameter.code, { value: event.target.value })
                                }
                                disabled={busy || draft.unavailable}
                                placeholder={draft.unavailable ? "Unavailable" : ""}
                              />
                            )}
                          </Field>

                          {/* The explicit "cannot supply this" answer. It is
                              stored, and it is what makes the result say
                              missing-input rather than leaving a silent gap. */}
                          <label className="mt-2 flex items-center gap-2 text-xs text-ink-subtle">
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5 rounded border-line-strong text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                              checked={draft.unavailable}
                              onChange={(event) =>
                                set(parameter.code, {
                                  unavailable: event.target.checked,
                                  value: event.target.checked ? "" : draft.value,
                                })
                              }
                              disabled={busy}
                            />
                            Not available for this project
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              );
            })}
          </div>

          {saveError && (
            <div className="mt-5">
              <InlineError message={saveError} />
            </div>
          )}

          {/* Sticky, because the form is long and the two actions are the
              reason the page exists. */}
          <div className="sticky bottom-0 -mx-4 mt-5 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-ink-subtle">
                {changed.length === 0
                  ? savedAt
                    ? `Saved at ${savedAt}.`
                    : "No unsaved changes."
                  : `${formatCount(changed.length)} unsaved change${changed.length === 1 ? "" : "s"}.`}
                {restored && changed.length > 0 && (
                  // Says where the values came from. Finding a form already
                  // filled in is otherwise indistinguishable from the page
                  // having saved them, which it has not.
                  <span className="text-ink-subtle">
                    {" "}Restored from this browser — not saved yet.
                  </span>
                )}
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  tone="secondary"
                  icon={Save}
                  onClick={save}
                  busy={saving}
                  disabled={busy || changed.length === 0}
                >
                  Save
                </Button>

                <Button icon={Calculator} onClick={saveAndCalculate} busy={calculating}>
                  Save and calculate
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
