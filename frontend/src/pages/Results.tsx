import { useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  CircleSlash,
  FileWarning,
  Info,
  Minus,
  Quote,
  ShieldAlert,
} from "lucide-react";

import { Empty, ErrorState, InlineError, Loading } from "../components/ui/States";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Note,
  PageHeader,
} from "../components/ui/Primitives";
import { api } from "../lib/api";
import { useApi } from "../lib/useApi";
import { useLatestAssessment } from "../lib/useAssessment";
import { formatCount, formatDateTime } from "../lib/format";
import type { CalculationStatus, ModuleResult } from "../lib/types";

// What each status means in plain words. The four NOT_* cases are the point
// of the whole design: they say why a figure is absent so it is never read
// as a zero.
const STATUS_LABEL: Record<CalculationStatus, string> = {
  CALCULATED: "Calculated",
  NOT_CALCULATED_MISSING_INPUT: "Needs more input",
  NOT_CALCULATED_UNIT_MISMATCH: "Unit mismatch",
  NOT_CALCULATED_NO_FACTOR: "No published factor",
  NOT_APPLICABLE: "Not applicable",
  VERIFICATION_REQUIRED: "Verification required",
};

/** Formats a NUMERIC that node-pg returned as a string. Returns null rather
 *  than NaN for anything unparseable, so a gap looks like a gap. */
function asNumber(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatResult(value: string | null): string | null {
  const parsed = asNumber(value);
  if (parsed === null) return null;
  // Intensities can be small and emissions large, so the precision follows
  // the magnitude rather than being fixed.
  const digits = Math.abs(parsed) >= 100 ? 2 : Math.abs(parsed) >= 1 ? 3 : 6;
  return parsed.toLocaleString("en-IN", { maximumFractionDigits: digits });
}

function Verdict({ result }: { result: ModuleResult }) {
  if (result.comparison === "within_limit") {
    return (
      <Badge tone="ok" icon={CheckCircle2}>
        Within limit
      </Badge>
    );
  }
  if (result.comparison === "outside_limit") {
    return (
      <Badge tone="risk" icon={AlertTriangle}>
        Outside limit
      </Badge>
    );
  }
  // Most outputs have no published threshold, and the specification says to
  // say so rather than let silence read as a pass.
  return (
    <Badge tone="neutral" icon={Minus}>
      Not compared
    </Badge>
  );
}

function ResultRow({ result }: { result: ModuleResult }) {
  const [open, setOpen] = useState(false);

  const shown = formatResult(result.value_numeric);
  const calculated = result.status === "CALCULATED";
  const provenance = result.constants_used;
  const cited = provenance?.constants ?? [];
  const limits = provenance?.limits ?? [];

  return (
    <li className="border-b border-line last:border-b-0">
      <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">{result.label ?? result.output_code}</p>

          {result.formula_text && (
            <p className="mt-1 flex items-start gap-1.5 text-xs text-ink-subtle">
              <Quote size={11} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span className="tabular">{result.formula_text}</span>
            </p>
          )}

          {!calculated && (
            <p className="mt-2 text-xs text-ink-muted">
              {provenance?.detail
                ?? (result.missing_inputs?.length
                  ? `Waiting for: ${result.missing_inputs.join(", ")}.`
                  : "Not calculated.")}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
          <div className="flex items-baseline gap-1.5">
            {shown === null ? (
              <span className="text-sm text-ink-subtle">Not calculated</span>
            ) : (
              <>
                <span className="tabular text-lg font-semibold text-ink">{shown}</span>
                {result.unit && (
                  <span className="text-xs text-ink-subtle">{result.unit}</span>
                )}
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {calculated ? (
              <Verdict result={result} />
            ) : (
              <Badge tone="neutral" icon={CircleSlash}>
                {STATUS_LABEL[result.status]}
              </Badge>
            )}

            {result.provisional && (
              <Badge tone="warn" icon={ShieldAlert}>
                Provisional
              </Badge>
            )}
          </div>

          {result.limit_value !== null && (
            <p className="tabular text-xs text-ink-subtle">
              Limit {formatResult(result.limit_value)} {result.limit_unit}
            </p>
          )}

          {(cited.length > 0 || limits.length > 0 || result.inputs_used?.length) && (
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              className="text-xs font-semibold text-brand transition-colors duration-200 hover:text-brand-hover"
            >
              {open ? "Hide workings" : "Show workings"}
            </button>
          )}
        </div>
      </div>

      {/* The workings are the reason a figure can be defended: the inputs it
          multiplied, and the published source of every constant it used. */}
      {open && (
        <div className="space-y-3 border-t border-line bg-surface-sunken px-5 py-4 text-xs">
          {result.inputs_used?.length ? (
            <div>
              <p className="font-semibold text-ink">Inputs used</p>
              <ul className="mt-1 space-y-0.5 text-ink-muted">
                {result.inputs_used.map((input) => (
                  <li key={input.code} className="tabular">
                    {input.label ?? input.code}:{" "}
                    {input.value === null ? input.text : input.value.toLocaleString("en-IN")}{" "}
                    {input.unit}
                    {input.source_status !== "USER_REPORTED" && ` (${input.source_status})`}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {cited.length > 0 && (
            <div>
              <p className="font-semibold text-ink">Constants applied</p>
              <ul className="mt-1 space-y-0.5 text-ink-muted">
                {cited.map((constant) => (
                  <li key={constant.code} className="tabular">
                    {constant.label}: {constant.value} {constant.unit} — {constant.source}
                    {constant.version && ` (${constant.version})`}
                    {!constant.verified && " — not yet checked by a person"}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {limits.length > 0 && (
            <div>
              <p className="font-semibold text-ink">Limit applied</p>
              <ul className="mt-1 space-y-0.5 text-ink-muted">
                {limits.map((limit) => (
                  <li key={limit.code} className="tabular">
                    {limit.label}: {limit.value} {limit.unit} — {limit.source}
                    {limit.version && ` (${limit.version})`}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {provenance?.derived_from?.length ? (
            <div>
              <p className="font-semibold text-ink">Built from</p>
              <p className="mt-1 text-ink-muted">{provenance.derived_from.join(", ")}</p>
            </div>
          ) : null}

          {result.limitation_note && (
            <div>
              <p className="font-semibold text-ink">Limitations</p>
              <p className="mt-1 text-ink-muted">{result.limitation_note}</p>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export default function Results() {
  const { id: projectId } = useParams<{ id: string }>();

  const project = useApi(
    () => (projectId ? api.getProject(projectId) : Promise.reject(new Error("No project."))),
    [projectId]
  );
  const { assessment, loading: assessmentLoading } = useLatestAssessment(projectId);

  const results = useApi(
    () =>
      assessment
        ? api.getResults(assessment.id)
        : Promise.resolve({ run: null, results: [], calculated: false }),
    [assessment?.id]
  );

  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (!assessment) return;
    setRunning(true);
    setRunError(null);
    try {
      await api.runCalculation(assessment.id);
      results.reload();
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "Could not calculate.");
    } finally {
      setRunning(false);
    }
  }, [assessment, results]);

  if (project.loading || assessmentLoading || results.loading) {
    return <Loading label="Loading results..." />;
  }

  if (results.error) {
    return <ErrorState message={results.error} onRetry={results.reload} />;
  }

  const rows = results.data?.results ?? [];
  const calculatedCount = rows.filter((r) => r.status === "CALCULATED").length;
  const provisionalCount = rows.filter((r) => r.provisional).length;
  const outsideCount = rows.filter((r) => r.comparison === "outside_limit").length;

  // Grouped by module, preserving the order the backend sent, which is the
  // display order held in the modules table.
  const byModule: { code: string; name: string; results: ModuleResult[] }[] = [];
  for (const result of rows) {
    const last = byModule[byModule.length - 1];
    if (last && last.code === result.module_code) last.results.push(result);
    else byModule.push({ code: result.module_code, name: result.module_name, results: [result] });
  }

  return (
    <div>
      <PageHeader
        eyebrow={project.data?.project.name ?? "Project"}
        title="Calculated results"
        hint="Quantities and limit comparisons, each with the inputs and published sources behind it."
        action={
          <div className="flex items-center gap-3">
            <Link
              to={`/projects/${projectId}/inputs`}
              className="text-xs font-semibold text-brand transition-colors duration-200 hover:text-brand-hover"
            >
              Edit inputs
            </Link>
            {assessment && (
              <Button icon={Calculator} onClick={run} busy={running}>
                Recalculate
              </Button>
            )}
          </div>
        }
      />

      {runError && (
        <div className="mb-5">
          <InlineError message={runError} />
        </div>
      )}

      {!assessment || !results.data?.calculated ? (
        <Card>
          <Empty
            title="Nothing calculated yet"
            hint={
              assessment
                ? "Enter the figures the modules need, then calculate. Anything you cannot supply is reported as missing rather than assumed."
                : "Start an assessment and enter some figures first."
            }
            action={
              <Button
                icon={Calculator}
                onClick={run}
                busy={running}
                disabled={!assessment}
              >
                Calculate now
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                Calculated
              </p>
              <p className="tabular mt-1 text-2xl font-semibold text-ink">
                {formatCount(calculatedCount)}
                <span className="text-sm text-ink-subtle"> of {formatCount(rows.length)}</span>
              </p>
            </Card>

            <Card className="p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                Outside a limit
              </p>
              <p className="tabular mt-1 text-2xl font-semibold text-ink">
                {formatCount(outsideCount)}
              </p>
            </Card>

            <Card className="p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                Provisional
              </p>
              <p className="tabular mt-1 text-2xl font-semibold text-ink">
                {formatCount(provisionalCount)}
              </p>
            </Card>
          </div>

          {provisionalCount > 0 && (
            <div className="mb-5">
              <Note tone="warn" icon={FileWarning} title="Provisional figures">
                {formatCount(provisionalCount)} result
                {provisionalCount === 1 ? "" : "s"} rest on a constant or limit that nobody
                has yet checked against the source document. The arithmetic is sound; the
                reference value is not confirmed. The grid emission factor seeded here is
                CEA Version 21.0, and CEA publishes 22.0.
              </Note>
            </div>
          )}

          <div className="space-y-5">
            {byModule.map((module) => (
              <Card key={module.code}>
                <CardHeader
                  title={module.name}
                  hint={`${formatCount(
                    module.results.filter((r) => r.status === "CALCULATED").length
                  )} of ${formatCount(module.results.length)} calculated`}
                />
                <ul>
                  {module.results.map((result) => (
                    <ResultRow key={result.output_code} result={result} />
                  ))}
                </ul>
              </Card>
            ))}
          </div>

          {results.data.run && (
            <div className="mt-5">
              <Note tone="neutral" icon={Info} title="This run">
                Engine {results.data.run.engine_version}, finished{" "}
                {formatDateTime(results.data.run.completed_at)} in{" "}
                {formatCount(results.data.run.duration_ms ?? 0)} ms. Preliminary screening
                only: these figures are not a statutory EIA, a laboratory result or a legal
                determination.
              </Note>
            </div>
          )}
        </>
      )}
    </div>
  );
}
