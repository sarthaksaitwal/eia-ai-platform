import { Link } from "react-router-dom";
import { ChevronRight, ClipboardCheck, Database, FolderKanban, MapPin, Plus } from "lucide-react";
import type { ComponentType } from "react";

import { Empty, ErrorState, Loading } from "../components/ui/States";
import { ButtonLink, Card, PageHeader } from "../components/ui/Primitives";
import { api } from "../lib/api";
import { useApi } from "../lib/useApi";
import { formatCount, formatPlace } from "../lib/format";

/* ---------------------------------------------------------------------------
   Project inputs and Calculated results both belong to one project, so the
   sidebar has no id to link with. This stands in between: pick the project,
   then go to that screen for it.

   One component serves both, because all that differs is where a row points
   and what the heading says. Two near-identical files would drift apart the
   first time only one of them was edited.
--------------------------------------------------------------------------- */

const DESTINATIONS: Record<
  string,
  {
    icon: ComponentType<{ size?: number; className?: string }>;
    title: string;
    hint: string;
    emptyHint: string;
    action: string;
  }
> = {
  inputs: {
    icon: ClipboardCheck,
    title: "Project inputs",
    hint: "Pick a project to enter or edit the figures its assessment runs on.",
    emptyHint:
      "Create a project and set its location, and its input form will open from here.",
    action: "Enter inputs",
  },
  results: {
    icon: Database,
    title: "Calculated results",
    hint: "Pick a project to see what was calculated, and the workings behind each figure.",
    emptyHint:
      "Create a project and fill in its inputs, and its results will open from here.",
    action: "View results",
  },
};

export type Destination = "inputs" | "results";

export default function PickProject({ destination }: { destination: Destination }) {
  const { data, loading, error, reload } = useApi(() => api.listProjects(), []);

  const projects = data?.projects ?? [];
  const { icon: Icon, title, hint, emptyHint, action } = DESTINATIONS[destination];

  return (
    <div>
      <PageHeader
        eyebrow="Assessment"
        title={title}
        hint={hint}
        action={
          <ButtonLink to="/projects/new" tone="secondary" icon={Plus}>
            New project
          </ButtonLink>
        }
      />

      {loading && <Loading label="Loading your projects..." />}

      {!loading && error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && projects.length === 0 && (
        <Empty
          title="No projects yet"
          hint={emptyHint}
          action={
            <ButtonLink to="/projects/new" icon={Plus}>
              Create your first project
            </ButtonLink>
          }
        />
      )}

      {!loading && !error && projects.length > 0 && (
        <Card>
          <ul>
            {projects.map((project) => (
              <li key={project.id} className="border-b border-line last:border-b-0">
                {/* A link rather than a div with onClick, so the row is
                    reachable by keyboard and openable in a new tab. */}
                <Link
                  to={`/projects/${project.id}/${destination}`}
                  className="flex items-center gap-3 p-4 transition-colors duration-200 hover:bg-surface-sunken lg:px-5 lg:py-3.5"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-neutral-soft text-ink-muted">
                    <FolderKanban size={17} aria-hidden="true" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {project.name}
                    </span>

                    <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-ink-subtle">
                      <MapPin size={12} className="shrink-0" aria-hidden="true" />
                      <span className="truncate">
                        {project.industry} &middot; {formatPlace(project)}
                      </span>
                    </span>
                  </span>

                  <span className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-brand">
                    <Icon size={15} className="hidden sm:block" aria-hidden="true" />
                    <span className="hidden sm:inline">{action}</span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <div className="tabular border-t border-line bg-surface-sunken px-5 py-2.5 text-xs text-ink-subtle">
            {formatCount(projects.length)}{" "}
            {projects.length === 1 ? "project" : "projects"}
          </div>
        </Card>
      )}
    </div>
  );
}
