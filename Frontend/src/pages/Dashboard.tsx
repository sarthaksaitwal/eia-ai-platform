import {
  ArrowUpRight,
  ClipboardCheck,
  FolderKanban,
  FileText,
  MapPin,
  MoreHorizontal,
} from "lucide-react";

import { demoProject, recentProjects } from "../data/dummyData";

const impactItems = [
  { label: "Air", value: demoProject.impacts.air },
  { label: "Water", value: demoProject.impacts.water },
  { label: "Ecology", value: demoProject.impacts.ecology },
  { label: "Carbon", value: demoProject.impacts.carbon },
  { label: "Resource", value: demoProject.impacts.resource },
  { label: "Waste", value: demoProject.impacts.waste },
  { label: "Noise", value: demoProject.impacts.noise },
];

function getScoreLabel(score: number) {
  if (score >= 75) return "High";
  if (score >= 50) return "Moderate";
  return "Low";
}

function getScoreText(score: number) {
  if (score >= 75) return "text-red-700";
  if (score >= 50) return "text-amber-700";
  return "text-emerald-700";
}

export default function Dashboard() {
  return (
    <div>
      {/* Page heading */}
      <div className="mb-7 flex items-end justify-between">
        <div>
          <p className="mb-1 text-sm font-medium text-emerald-700">
            Overview
          </p>

          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Dashboard
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Monitor your environmental assessments and project activity.
          </p>
        </div>

        <button className="flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-800">
          <ClipboardCheck size={16} />
          New Assessment
        </button>
      </div>

      {/* Main project */}
      <section className="mb-6 border border-slate-200 bg-white">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Active Project
              </span>

              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                {demoProject.status}
              </span>
            </div>

            <h2 className="text-lg font-semibold text-slate-900">
              {demoProject.name}
            </h2>

            <div className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
              <MapPin size={14} />
              {demoProject.location}
            </div>
          </div>

          <button className="text-slate-400 hover:text-slate-700">
            <MoreHorizontal size={19} />
          </button>
        </div>

        <div className="grid grid-cols-4 divide-x divide-slate-200">
          <div className="px-6 py-5">
            <p className="text-xs text-slate-500">Project Type</p>
            <p className="mt-1 text-sm font-medium text-slate-800">
              {demoProject.type}
            </p>
          </div>

          <div className="px-6 py-5">
            <p className="text-xs text-slate-500">Industry</p>
            <p className="mt-1 text-sm font-medium text-slate-800">
              {demoProject.industry}
            </p>
          </div>

          <div className="px-6 py-5">
            <p className="text-xs text-slate-500">Project Area</p>
            <p className="mt-1 text-sm font-medium text-slate-800">
              {demoProject.area}
            </p>
          </div>

          <div className="px-6 py-5">
            <p className="text-xs text-slate-500">Investment</p>
            <p className="mt-1 text-sm font-medium text-slate-800">
              {demoProject.investment}
            </p>
          </div>
        </div>
      </section>

      {/* Statistics */}
      <div className="mb-6 grid grid-cols-4 gap-4">
        <div className="border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex h-9 w-9 items-center justify-center bg-slate-100 text-slate-600">
              <FolderKanban size={18} />
            </div>

            <ArrowUpRight size={16} className="text-slate-400" />
          </div>

          <p className="text-xs text-slate-500">Total Projects</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">12</p>
        </div>

        <div className="border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex h-9 w-9 items-center justify-center bg-slate-100 text-slate-600">
              <ClipboardCheck size={18} />
            </div>

            <ArrowUpRight size={16} className="text-slate-400" />
          </div>

          <p className="text-xs text-slate-500">Assessments Completed</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">8</p>
        </div>

        <div className="border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex h-9 w-9 items-center justify-center bg-amber-50 text-amber-700">
              <span className="text-sm font-semibold">64</span>
            </div>
          </div>

          <p className="text-xs text-slate-500">Current Impact Score</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {demoProject.overallScore}
            <span className="ml-1 text-sm font-normal text-slate-400">
              /100
            </span>
          </p>
        </div>

        <div className="border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex h-9 w-9 items-center justify-center bg-emerald-50 text-emerald-700">
              <FileText size={18} />
            </div>

            <ArrowUpRight size={16} className="text-slate-400" />
          </div>

          <p className="text-xs text-slate-500">Reports Generated</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">6</p>
        </div>
      </div>

      {/* Impact + recent assessments */}
      <div className="grid grid-cols-3 gap-6">
        {/* Impact overview */}
        <section className="col-span-2 border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Environmental Impact Overview
              </h2>

              <p className="mt-0.5 text-xs text-slate-500">
                Factor-wise scores for the active project
              </p>
            </div>

            <button className="text-xs font-medium text-emerald-700 hover:text-emerald-800">
              View assessment
            </button>
          </div>

          <div className="p-6">
            <div className="space-y-5">
              {impactItems.map((item) => (
                <div key={item.label}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">
                      {item.label}
                    </span>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-medium ${getScoreText(
                          item.value
                        )}`}
                      >
                        {getScoreLabel(item.value)}
                      </span>

                      <span className="w-8 text-right text-sm font-semibold text-slate-800">
                        {item.value}
                      </span>
                    </div>
                  </div>

                  <div className="h-2 w-full bg-slate-100">
                    <div
                      className={`h-full ${
                        item.value >= 75
                          ? "bg-red-500"
                          : item.value >= 50
                            ? "bg-amber-500"
                            : "bg-emerald-600"
                      }`}
                      style={{ width: `${item.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Recent projects */}
        <section className="border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Recent Assessments
              </h2>

              <p className="mt-0.5 text-xs text-slate-500">
                Latest completed projects
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {recentProjects.map((project) => (
              <div key={project.name} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {project.name}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {project.location}
                    </p>
                  </div>

                  <span
                    className={`shrink-0 text-sm font-semibold ${getScoreText(
                      project.score
                    )}`}
                  >
                    {project.score}
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    {project.status}
                  </span>

                  <span className="text-[11px] text-slate-400">
                    Impact score
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-200 px-5 py-3">
            <button className="text-xs font-medium text-emerald-700 hover:text-emerald-800">
              View all assessments →
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}