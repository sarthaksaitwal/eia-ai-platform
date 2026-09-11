import {
  FolderKanban,
  MapPin,
  Plus,
  Search,
  MoreHorizontal,
} from "lucide-react";

import { demoProject, recentProjects } from "../data/dummyData";

const projects = [
  {
    name: demoProject.name,
    type: demoProject.type,
    industry: demoProject.industry,
    location: demoProject.location,
    score: demoProject.overallScore,
    status: demoProject.status,
  },
  ...recentProjects.map((project) => ({
    name: project.name,
    type: "Industrial",
    industry: "Manufacturing",
    location: project.location,
    score: project.score,
    status: project.status,
  })),
];

function getScoreText(score: number) {
  if (score >= 75) return "text-red-700";
  if (score >= 50) return "text-amber-700";
  return "text-emerald-700";
}

export default function Projects() {
  return (
    <div>
      {/* Page heading */}
      <div className="mb-7 flex items-end justify-between">
        <div>
          <p className="mb-1 text-sm font-medium text-emerald-700">
            Projects
          </p>

          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            All Projects
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            View and manage your environmental assessment projects.
          </p>
        </div>

        <button className="flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-800">
          <Plus size={16} />
          Create Project
        </button>
      </div>

      {/* Search and filters */}
      <div className="mb-5 flex items-center justify-between border border-slate-200 bg-white px-5 py-4">
        <div className="relative w-80">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            type="text"
            placeholder="Search projects..."
            className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-emerald-600 focus:bg-white"
          />
        </div>

        <select className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-600 outline-none focus:border-emerald-600">
          <option>All Statuses</option>
          <option>Assessment Completed</option>
          <option>In Progress</option>
          <option>Draft</option>
        </select>
      </div>

      {/* Project table */}
      <div className="border border-slate-200 bg-white">
        <div className="grid grid-cols-[2fr_1fr_1.4fr_1.5fr_0.8fr_1.2fr_40px] items-center border-b border-slate-200 bg-slate-50 px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <span>Project</span>
          <span>Type</span>
          <span>Industry</span>
          <span>Location</span>
          <span>Score</span>
          <span>Status</span>
          <span></span>
        </div>

        {projects.map((project) => (
          <div
            key={project.name}
            className="grid grid-cols-[2fr_1fr_1.4fr_1.5fr_0.8fr_1.2fr_40px] items-center border-b border-slate-100 px-5 py-4 last:border-b-0 hover:bg-slate-50/60"
          >
            {/* Project */}
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-slate-100 text-slate-600">
                <FolderKanban size={17} />
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">
                  {project.name}
                </p>

                <p className="mt-0.5 text-xs text-slate-400">
                  Environmental assessment
                </p>
              </div>
            </div>

            {/* Type */}
            <span className="text-sm text-slate-600">
              {project.type}
            </span>

            {/* Industry */}
            <span className="text-sm text-slate-600">
              {project.industry}
            </span>

            {/* Location */}
            <div className="flex items-center gap-1.5 text-sm text-slate-600">
              <MapPin size={14} className="text-slate-400" />
              <span className="truncate">{project.location}</span>
            </div>

            {/* Score */}
            <span
              className={`text-sm font-semibold ${getScoreText(
                project.score
              )}`}
            >
              {project.score}/100
            </span>

            {/* Status */}
            <span className="inline-flex w-fit rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
              {project.status}
            </span>

            {/* Actions */}
            <button className="text-slate-400 hover:text-slate-700">
              <MoreHorizontal size={18} />
            </button>
          </div>
        ))}

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
          <span className="text-xs text-slate-500">
            Showing {projects.length} projects
          </span>

          <span className="text-xs text-slate-400">
            All projects
          </span>
        </div>
      </div>
    </div>
  );
}