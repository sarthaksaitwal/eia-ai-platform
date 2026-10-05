import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FolderKanban, MapPin, MoreHorizontal, Plus, Search } from "lucide-react";

import { Empty, ErrorState, Loading } from "../components/ui/States";
import { api } from "../lib/api";
import { useApi } from "../lib/useApi";
import type { Project } from "../lib/types";

// projects.status is free text in the schema, so this only colours the values
// the backend actually sets and leaves anything else neutral.
function statusClass(status: string) {
  switch (status) {
    case "Completed":
      return "bg-emerald-50 text-emerald-700";
    case "In Progress":
      return "bg-amber-50 text-amber-700";
    case "Draft":
      return "bg-slate-100 text-slate-600";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

// findProjectsByUser flattens the location columns onto the row rather than
// nesting them, so the place a project sits has to be assembled here.
function placeOf(project: Project) {
  const parts = [project.city, project.district, project.state].filter(
    (part): part is string => Boolean(part && part.trim())
  );
  if (parts.length) return parts.join(", ");

  if (project.latitude && project.longitude) {
    return `${Number(project.latitude).toFixed(4)}, ${Number(project.longitude).toFixed(4)}`;
  }
  return "No location set";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function Projects() {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useApi(() => api.listProjects(), []);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");

  // Memoised so the filters below are not rebuilt on every render.
  const projects = useMemo(() => data?.projects ?? [], [data]);

  const statuses = useMemo(
    () => ["All", ...Array.from(new Set(projects.map((p) => p.status))).sort()],
    [projects]
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return projects.filter((project) => {
      if (status !== "All" && project.status !== status) return false;
      if (!term) return true;
      return (
        project.name.toLowerCase().includes(term) ||
        project.industry.toLowerCase().includes(term) ||
        placeOf(project).toLowerCase().includes(term)
      );
    });
  }, [projects, search, status]);

  return (
    <div>
      <div className="mb-7 flex items-end justify-between">
        <div>
          <p className="mb-1 text-sm font-medium text-emerald-700">Projects</p>

          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">All Projects</h1>

          <p className="mt-1 text-sm text-slate-500">
            View and manage your environmental assessment projects.
          </p>
        </div>

        <Link
          to="/projects/new"
          className="flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-800"
        >
          <Plus size={16} />
          Create Project
        </Link>
      </div>

      {loading && <Loading label="Loading your projects..." />}

      {!loading && error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && projects.length === 0 && (
        <Empty
          title="No projects yet"
          hint="Create a project to record its site and start an environmental assessment."
          action={
            <Link
              to="/projects/new"
              className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-800"
            >
              <Plus size={16} />
              Create your first project
            </Link>
          }
        />
      )}

      {!loading && !error && projects.length > 0 && (
        <>
          <div className="mb-5 flex items-center justify-between border border-slate-200 bg-white px-5 py-4">
            <div className="relative w-80">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects..."
                className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-emerald-600 focus:bg-white"
              />
            </div>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-600 outline-none focus:border-emerald-600"
            >
              {statuses.map((option) => (
                <option key={option} value={option}>
                  {option === "All" ? "All statuses" : option}
                </option>
              ))}
            </select>
          </div>

          <div className="border border-slate-200 bg-white">
            <div className="grid grid-cols-[2fr_1fr_1.4fr_1.5fr_1fr_1.1fr_40px] items-center border-b border-slate-200 bg-slate-50 px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <span>Project</span>
              <span>Type</span>
              <span>Industry</span>
              <span>Location</span>
              <span>Created</span>
              <span>Status</span>
              <span />
            </div>

            {visible.map((project) => (
              <div
                key={project.id}
                onClick={() => navigate(`/projects/${project.id}/location`)}
                className="grid cursor-pointer grid-cols-[2fr_1fr_1.4fr_1.5fr_1fr_1.1fr_40px] items-center border-b border-slate-100 px-5 py-4 last:border-b-0 hover:bg-slate-50/60"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-slate-100 text-slate-600">
                    <FolderKanban size={17} />
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{project.name}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-400">
                      {project.description || "Environmental assessment"}
                    </p>
                  </div>
                </div>

                <span className="text-sm text-slate-600">{project.project_type || "—"}</span>

                <span className="truncate text-sm text-slate-600">{project.industry}</span>

                <div className="flex items-center gap-1.5 text-sm text-slate-600">
                  <MapPin size={14} className="shrink-0 text-slate-400" />
                  <span className="truncate">{placeOf(project)}</span>
                </div>

                <span className="text-sm text-slate-500">{formatDate(project.created_at)}</span>

                <span
                  className={`inline-flex w-fit rounded-full px-2.5 py-1 text-[11px] font-medium ${statusClass(
                    project.status
                  )}`}
                >
                  {project.status}
                </span>

                <button
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Project actions"
                  className="text-slate-400 hover:text-slate-700"
                >
                  <MoreHorizontal size={18} />
                </button>
              </div>
            ))}

            {visible.length === 0 && (
              <div className="px-5 py-10 text-center text-sm text-slate-500">
                No project matches that search.
              </div>
            )}

            <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
              <span className="text-xs text-slate-500">
                Showing {visible.length} of {projects.length}{" "}
                {projects.length === 1 ? "project" : "projects"}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
