import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  ClipboardCheck,
  Database,
  FolderKanban,
  Info,
  MapPin,
  Plus,
  Scale,
  ShieldAlert,
} from "lucide-react";

import { Empty, ErrorState, Loading } from "../components/ui/States";
import {
  Badge,
  ButtonLink,
  Card,
  CardHeader,
  Note,
  PageHeader,
  StatCard,
} from "../components/ui/Primitives";
import { api } from "../lib/api";
import { useApi } from "../lib/useApi";
import { useAuth } from "../lib/auth";
import { formatCoords, formatCount, formatDate } from "../lib/format";
import type { Assessment } from "../lib/types";

export default function Dashboard() {
  const { user } = useAuth();

  const projects = useApi(() => api.listProjects(), []);

  // There is no endpoint that lists every assessment, only one per project,
  // so the per-project calls run together and the results are flattened.
  const projectIds = (projects.data?.projects ?? []).map((p) => p.id).join(",");
  const assessments = useApi(async () => {
    const list = projects.data?.projects ?? [];
    if (!list.length) return [] as Assessment[];
    const results = await Promise.all(list.map((p) => api.listAssessments(p.id)));
    return results.flatMap((r) => r.assessments);
  }, [projectIds]);

  const standards = useApi(() => api.listStandards(), []);
  const coefficients = useApi(() => api.listCoefficients(), []);

  const projectRows = projects.data?.projects ?? [];
  const assessmentRows = assessments.data ?? [];
  const standardRows = useMemo(() => standards.data?.standards ?? [], [standards.data]);
  const coefficientRows = useMemo(
    () => coefficients.data?.coefficients ?? [],
    [coefficients.data]
  );

  // Only a coefficient with an input parameter and both units can turn an
  // entered quantity into a result; the rest are reference-only rows.
  const usableCoefficients = useMemo(
    () =>
      coefficientRows.filter((c) => c.input_parameter && c.unit && c.result_unit && c.active)
        .length,
    [coefficientRows]
  );

  const byStandard = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of standardRows) {
      counts.set(row.standard_name, (counts.get(row.standard_name) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [standardRows]);

  const recent = [...projectRows]
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .slice(0, 5);

  const unverified = standards.data?.unverified_count ?? 0;

  return (
    <div>
      <PageHeader
        eyebrow="Overview"
        title={user ? `Welcome back, ${user.name.split(" ")[0]}` : "Dashboard"}
        hint="Projects, sites and the reference data available for comparison."
        action={
          <ButtonLink to="/projects/new" icon={Plus}>
            New project
          </ButtonLink>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Projects"
          value={projects.loading ? "—" : formatCount(projectRows.length)}
          icon={FolderKanban}
          to="/projects"
        />

        <StatCard
          label="Assessments"
          value={assessments.loading ? "—" : formatCount(assessmentRows.length)}
          icon={ClipboardCheck}
          to="/projects"
        />

        <StatCard
          label="Regulatory limits"
          value={standards.loading ? "—" : formatCount(standardRows.length)}
          hint={standards.loading ? undefined : `${formatCount(unverified)} not yet checked`}
          icon={Scale}
        />

        <StatCard
          label="Usable coefficients"
          value={coefficients.loading ? "—" : formatCount(usableCoefficients)}
          hint={
            coefficients.loading
              ? undefined
              : `of ${formatCount(coefficientRows.length)} seeded rows`
          }
          icon={Database}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Recent projects"
            hint="The five most recently created."
            action={
              <Link
                to="/projects"
                className="flex items-center gap-1 text-xs font-semibold text-brand transition-colors duration-200 hover:text-brand-hover"
              >
                View all
                <ArrowUpRight size={13} aria-hidden="true" />
              </Link>
            }
          />

          {projects.loading && <Loading label="Loading projects..." />}

          {projects.error && (
            <div className="p-5">
              <ErrorState message={projects.error} onRetry={projects.reload} />
            </div>
          )}

          {!projects.loading && !projects.error && recent.length === 0 && (
            <Empty
              title="No projects yet"
              hint="Create a project to record its site and collect its environmental baseline."
              action={
                <ButtonLink to="/projects/new" icon={Plus}>
                  Create a project
                </ButtonLink>
              }
            />
          )}

          <ul>
            {recent.map((project) => {
              const place =
                [project.city, project.district, project.state].filter(Boolean).join(", ") ||
                formatCoords(project.latitude, project.longitude) ||
                "No location set";

              const count = assessmentRows.filter((a) => a.project_id === project.id).length;

              return (
                <li key={project.id} className="border-b border-line last:border-b-0">
                  <Link
                    to={`/projects/${project.id}/location`}
                    className="flex flex-col gap-2 px-5 py-3.5 transition-colors duration-200 hover:bg-surface-sunken sm:flex-row sm:items-center sm:gap-4"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-neutral-soft text-ink-muted">
                      <FolderKanban size={17} aria-hidden="true" />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">
                        {project.name}
                      </span>

                      <span className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-subtle">
                        <MapPin size={12} className="shrink-0" aria-hidden="true" />
                        <span className="truncate">{place}</span>
                      </span>
                    </span>

                    <span className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 pl-12 text-xs text-ink-muted sm:pl-0">
                      <span className="truncate">{project.industry}</span>

                      <span className="tabular">
                        {formatCount(count)} assessment{count === 1 ? "" : "s"}
                      </span>

                      <span className="tabular text-ink-subtle">
                        {formatDate(project.created_at)}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Reference data" hint="Seeded limits available for comparison." />

          {standards.loading && <Loading label="Loading standards..." />}

          {standards.error && (
            <div className="p-5">
              <ErrorState message={standards.error} onRetry={standards.reload} />
            </div>
          )}

          {!standards.loading && !standards.error && (
            <>
              <ul>
                {byStandard.map(([standardName, count]) => (
                  <li
                    key={standardName}
                    className="flex items-center justify-between gap-3 border-b border-line px-5 py-2.5 last:border-b-0"
                  >
                    <span className="min-w-0 truncate text-sm text-ink-muted">
                      {standardName}
                    </span>

                    <span className="tabular shrink-0 text-sm font-semibold text-ink">
                      {formatCount(count)}
                    </span>
                  </li>
                ))}
              </ul>

              {unverified > 0 && (
                <div className="border-t border-line p-4">
                  <Note tone="warn" icon={ShieldAlert} title="Provisional reference data">
                    {formatCount(unverified)} of {formatCount(standardRows.length)} limits have
                    not been checked against the notification text by a person yet. A comparison
                    against them is provisional until they are.
                  </Note>
                </div>
              )}
            </>
          )}
        </Card>
      </div>

      {/* The calculation engine is not built, so there are no impact results
          to show. Saying so beats an empty chart that looks broken. */}
      <div className="mt-5">
        <Note tone="neutral" icon={Info} title="Impact results are not calculated yet">
          <p>
            The platform currently records projects, sites and the collected environmental
            baseline. Quantities and within-limit comparisons appear here once the calculation
            engine is built, and will be derived from the seeded coefficients and limits.
          </p>

          <p className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone="ok">Within limit</Badge>
            <Badge tone="risk">Outside limit</Badge>
            <Badge tone="neutral">Not compared</Badge>
            <span className="text-xs text-ink-subtle">
              the three verdicts a comparison can produce
            </span>
          </p>
        </Note>
      </div>
    </div>
  );
}
