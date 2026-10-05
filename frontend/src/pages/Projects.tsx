import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  CircleDashed,
  FolderKanban,
  MapPin,
  Plus,
  Search,
  Timer,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import { Empty, ErrorState, Loading } from "../components/ui/States";
import {
  Badge,
  ButtonLink,
  Card,
  PageHeader,
  type Tone,
} from "../components/ui/Primitives";
import { inputClass, selectClass } from "../components/ui/fieldStyles";
import { api } from "../lib/api";
import { useApi } from "../lib/useApi";
import { formatCoords, formatCount, formatDate } from "../lib/format";
import type { Project } from "../lib/types";

// projects.status is free text in the schema, so this maps only the values the
// backend actually sets and leaves anything else neutral. Each status carries
// an icon as well as a colour: the verdict has to survive being read by
// someone who cannot tell the two hues apart, or printed in grey.
const STATUS: Record<
  string,
  { tone: Tone; icon: ComponentType<{ size?: number; className?: string }> }
> = {
  Completed: { tone: "ok", icon: CheckCircle2 },
  "In Progress": { tone: "brand", icon: Timer },
  Draft: { tone: "neutral", icon: CircleDashed },
};

// findProjectsByUser flattens the location columns onto the row rather than
// nesting them, so the place a project sits has to be assembled here.
function placeOf(project: Project) {
  const parts = [project.city, project.district, project.state].filter(
    (part): part is string => Boolean(part && part.trim())
  );
  if (parts.length) return parts.join(", ");

  return formatCoords(project.latitude, project.longitude) ?? "No location set";
}

const COLUMNS = "lg:grid-cols-[2.2fr_1fr_1.3fr_1.5fr_0.9fr_1fr]";

/**
 * One cell. Below lg the table has no header row to refer back to, so each
 * cell carries its own label and the row reads as a small record instead of a
 * line of unexplained values.
 */
function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3 lg:block">
      <span className="shrink-0 text-xs text-ink-subtle lg:hidden">{label}</span>
      <span className="min-w-0 truncate text-right text-sm text-ink-muted lg:text-left">
        {children}
      </span>
    </div>
  );
}

export default function Projects() {
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
      <PageHeader
        eyebrow="Projects"
        title="All projects"
        hint="Every project you have created, newest filters applied live."
        action={
          <ButtonLink to="/projects/new" icon={Plus}>
            Create project
          </ButtonLink>
        }
      />

      {loading && <Loading label="Loading your projects..." />}

      {!loading && error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && projects.length === 0 && (
        <Empty
          title="No projects yet"
          hint="Create a project to record its site and start an environmental assessment."
          action={
            <ButtonLink to="/projects/new" icon={Plus}>
              Create your first project
            </ButtonLink>
          }
        />
      )}

      {!loading && !error && projects.length > 0 && (
        <>
          <Card className="mb-4">
            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-sm">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"
                  aria-hidden="true"
                />

                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, industry or place"
                  aria-label="Search projects"
                  className={`${inputClass} pl-9`}
                />
              </div>

              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                aria-label="Filter by status"
                className={`${selectClass} sm:w-48`}
              >
                {statuses.map((option) => (
                  <option key={option} value={option}>
                    {option === "All" ? "All statuses" : option}
                  </option>
                ))}
              </select>
            </div>
          </Card>

          <Card>
            <div
              className={`hidden border-b border-line bg-surface-sunken px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle lg:grid ${COLUMNS} lg:items-center lg:gap-3`}
            >
              <span>Project</span>
              <span>Type</span>
              <span>Industry</span>
              <span>Location</span>
              <span>Created</span>
              <span>Status</span>
            </div>

            <ul>
              {visible.map((project) => {
                const skin = STATUS[project.status] ?? { tone: "neutral" as Tone, icon: undefined };

                return (
                  <li key={project.id} className="border-b border-line last:border-b-0">
                    {/* A link rather than a div with onClick: the row is then
                        reachable by keyboard, openable in a new tab, and
                        readable as a destination by a screen reader. */}
                    <Link
                      to={`/projects/${project.id}/location`}
                      className={`flex flex-col gap-2 p-4 transition-colors duration-200 hover:bg-surface-sunken lg:grid ${COLUMNS} lg:items-center lg:gap-3 lg:px-5 lg:py-3.5`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-neutral-soft text-ink-muted">
                          <FolderKanban size={17} aria-hidden="true" />
                        </span>

                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-ink">
                            {project.name}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-ink-subtle">
                            {project.description || "Environmental assessment"}
                          </span>
                        </span>
                      </div>

                      <Cell label="Type">{project.project_type || "—"}</Cell>

                      <Cell label="Industry">{project.industry}</Cell>

                      <div className="flex min-w-0 items-baseline justify-between gap-3 lg:block">
                        <span className="shrink-0 text-xs text-ink-subtle lg:hidden">
                          Location
                        </span>

                        <span className="flex min-w-0 items-center gap-1.5 text-sm text-ink-muted">
                          <MapPin
                            size={14}
                            className="hidden shrink-0 text-ink-subtle lg:block"
                            aria-hidden="true"
                          />
                          <span className="truncate">{placeOf(project)}</span>
                        </span>
                      </div>

                      <Cell label="Created">
                        <span className="tabular">{formatDate(project.created_at)}</span>
                      </Cell>

                      <div className="flex items-center justify-between gap-3 lg:block">
                        <span className="shrink-0 text-xs text-ink-subtle lg:hidden">Status</span>
                        <Badge tone={skin.tone} icon={skin.icon}>
                          {project.status}
                        </Badge>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>

            {visible.length === 0 && (
              <div className="px-5 py-10 text-center">
                <p className="text-sm font-semibold text-ink">No project matches that filter</p>
                <p className="mt-1 text-sm text-ink-muted">
                  Try a different search term, or set the status back to all.
                </p>
              </div>
            )}

            <div className="tabular border-t border-line bg-surface-sunken px-5 py-2.5 text-xs text-ink-subtle">
              Showing {formatCount(visible.length)} of {formatCount(projects.length)}{" "}
              {projects.length === 1 ? "project" : "projects"}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
