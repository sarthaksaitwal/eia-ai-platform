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
} from "lucide-react";

import { Empty, ErrorState, Loading } from "../components/ui/States";
import { api } from "../lib/api";
import { useApi } from "../lib/useApi";
import { useAuth } from "../lib/auth";
import type { Assessment } from "../lib/types";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

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
      coefficientRows.filter(
        (c) => c.input_parameter && c.unit && c.result_unit && c.active
      ).length,
    [coefficientRows]
  );

  const byStandard = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of standardRows) {
      counts.set(row.standard_name, (counts.get(row.standard_name) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [standardRows]);

  const stats = [
    {
      label: "Projects",
      value: projects.loading ? "—" : String(projectRows.length),
      icon: FolderKanban,
      to: "/projects",
    },
    {
      label: "Assessments",
      value: assessments.loading ? "—" : String(assessmentRows.length),
      icon: ClipboardCheck,
      to: "/projects",
    },
    {
      label: "Active regulatory limits",
      value: standards.loading ? "—" : String(standardRows.length),
      icon: Scale,
    },
    {
      label: "Usable coefficients",
      value: coefficients.loading ? "—" : `${usableCoefficients} of ${coefficientRows.length}`,
      icon: Database,
    },
  ];

  const recent = [...projectRows]
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .slice(0, 5);

  return (
    <div>
      <div className="mb-7 flex items-end justify-between">
        <div>
          <p className="mb-1 text-sm font-medium text-emerald-700">Overview</p>

          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {user ? `Welcome back, ${user.name.split(" ")[0]}` : "Dashboard"}
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Monitor your environmental assessments and project activity.
          </p>
        </div>

        <Link
          to="/projects/new"
          className="flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-800"
        >
          <Plus size={16} />
          New Project
        </Link>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-4 gap-4">
        {stats.map((stat) => {
          const card = (
            <div className="flex h-full items-start justify-between border border-slate-200 bg-white px-5 py-4">
              <div>
                <div className="text-2xl font-semibold tracking-tight text-slate-900">
                  {stat.value}
                </div>
                <div className="mt-1 text-sm text-slate-500">{stat.label}</div>
              </div>

              <div className="flex h-9 w-9 items-center justify-center bg-emerald-50 text-emerald-700">
                <stat.icon size={17} />
              </div>
            </div>
          );

          return stat.to ? (
            <Link key={stat.label} to={stat.to} className="block transition hover:opacity-90">
              {card}
            </Link>
          ) : (
            <div key={stat.label}>{card}</div>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Recent projects */}
        <section className="col-span-2 border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Recent Projects</h2>

            <Link
              to="/projects"
              className="flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800"
            >
              View all
              <ArrowUpRight size={13} />
            </Link>
          </div>

          {projects.loading && <Loading label="Loading projects..." />}

          {projects.error && (
            <div className="p-6">
              <ErrorState message={projects.error} onRetry={projects.reload} />
            </div>
          )}

          {!projects.loading && !projects.error && recent.length === 0 && (
            <Empty
              title="No projects yet"
              hint="Create a project to record its site and collect its environmental baseline."
              action={
                <Link
                  to="/projects/new"
                  className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-800"
                >
                  <Plus size={16} />
                  Create a project
                </Link>
              }
            />
          )}

          {recent.map((project) => {
            const place =
              [project.city, project.district, project.state].filter(Boolean).join(", ") ||
              (project.latitude && project.longitude
                ? `${Number(project.latitude).toFixed(3)}, ${Number(project.longitude).toFixed(3)}`
                : "No location");

            const count = assessmentRows.filter((a) => a.project_id === project.id).length;

            return (
              <Link
                key={project.id}
                to={`/projects/${project.id}/location`}
                className="flex items-center gap-4 border-b border-slate-100 px-6 py-4 last:border-b-0 hover:bg-slate-50/60"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-slate-100 text-slate-600">
                  <FolderKanban size={17} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{project.name}</p>

                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
                    <MapPin size={12} />
                    <span className="truncate">{place}</span>
                  </div>
                </div>

                <span className="shrink-0 text-xs text-slate-500">{project.industry}</span>

                <span className="shrink-0 text-xs text-slate-400">
                  {count} assessment{count === 1 ? "" : "s"}
                </span>

                <span className="shrink-0 text-xs text-slate-400">
                  {formatDate(project.created_at)}
                </span>
              </Link>
            );
          })}
        </section>

        {/* Reference data */}
        <section className="border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Reference Data</h2>
            <p className="mt-0.5 text-xs text-slate-500">Seeded limits available for comparison.</p>
          </div>

          {standards.loading && <Loading label="Loading standards..." />}

          {standards.error && (
            <div className="p-6">
              <ErrorState message={standards.error} onRetry={standards.reload} />
            </div>
          )}

          {!standards.loading && !standards.error && (
            <>
              <div className="divide-y divide-slate-100">
                {byStandard.map(([standardName, count]) => (
                  <div
                    key={standardName}
                    className="flex items-center justify-between gap-3 px-6 py-3"
                  >
                    <span className="min-w-0 truncate text-sm text-slate-700">{standardName}</span>
                    <span className="shrink-0 text-sm font-medium text-slate-900">{count}</span>
                  </div>
                ))}
              </div>

              {standards.data && standards.data.unverified_count > 0 && (
                <div className="border-t border-slate-200 bg-amber-50/60 px-6 py-4">
                  <div className="flex items-start gap-2">
                    <Info size={15} className="mt-0.5 shrink-0 text-amber-600" />
                    <p className="text-xs text-amber-900">
                      {standards.data.unverified_count} of {standardRows.length} limits have not
                      been checked against the notification text by a person yet. Until they are,
                      a comparison against them is provisional.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {/* The calculation engine is not built, so there are no impact results
          to show. Saying so beats an empty chart that looks broken. */}
      <div className="mt-6 flex items-start gap-3 border border-slate-200 bg-white px-6 py-5">
        <Info size={17} className="mt-0.5 shrink-0 text-slate-400" />

        <div>
          <p className="text-sm font-medium text-slate-800">
            Impact results are not calculated yet
          </p>
          <p className="mt-1 text-sm text-slate-500">
            The platform currently records projects, sites and the collected environmental
            baseline. Quantities and pass/fail comparisons appear here once the calculation
            engine is built, and will be derived from the seeded coefficients and limits rather
            than from a score.
          </p>
        </div>
      </div>
    </div>
  );
}
