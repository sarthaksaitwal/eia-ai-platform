import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  IndianRupee,
  Users,
  Clock3,
  Ruler,
} from "lucide-react";

export default function CreateProject() {
    const navigate = useNavigate();

    return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="mb-7">
        <p className="mb-1 text-sm font-medium text-emerald-700">
          Projects
        </p>

        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Create New Project
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Enter the basic details of the project to begin the environmental
          assessment.
        </p>
      </div>

      {/* Progress */}
      <div className="mb-6 border border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-700 text-xs font-semibold text-white">
              1
            </div>

            <span className="text-sm font-medium text-slate-900">
              Project Details
            </span>
          </div>

          <div className="mx-4 h-px flex-1 bg-slate-200" />

          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-xs font-medium text-slate-400">
              2
            </div>

            <span className="text-sm text-slate-400">
              Location & GIS
            </span>
          </div>

          <div className="mx-4 h-px flex-1 bg-slate-200" />

          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-xs font-medium text-slate-400">
              3
            </div>

            <span className="text-sm text-slate-400">
              Environmental Inputs
            </span>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="border border-slate-200 bg-white">
        {/* Basic information */}
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center bg-emerald-50 text-emerald-700">
              <Building2 size={18} />
            </div>

            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Basic Project Information
              </h2>

              <p className="mt-0.5 text-xs text-slate-500">
                Provide general information about the proposed project.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-5 p-6">
          {/* Project name */}
          <div className="col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Project Name
              <span className="ml-1 text-red-500">*</span>
            </label>

            <input
              type="text"
              placeholder="Enter project name"
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-emerald-600"
            />
          </div>

          {/* Project type */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Project Type
              <span className="ml-1 text-red-500">*</span>
            </label>

            <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-600">
              <option value="">Select project type</option>
              <option>Industrial</option>
              <option>Infrastructure</option>
              <option>Mining</option>
              <option>Energy</option>
              <option>Construction</option>
              <option>Other</option>
            </select>
          </div>

          {/* Industry */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Industry / Sector
              <span className="ml-1 text-red-500">*</span>
            </label>

            <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-600">
              <option value="">Select industry</option>
              <option>Chemical Manufacturing</option>
              <option>Food Processing</option>
              <option>Textile Manufacturing</option>
              <option>Pharmaceutical</option>
              <option>Automobile</option>
              <option>Other Manufacturing</option>
            </select>
          </div>

          {/* Project area */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Project Area
              <span className="ml-1 text-red-500">*</span>
            </label>

            <div className="relative">
              <Ruler
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="number"
                placeholder="25"
                className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-16 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-emerald-600"
              />

              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                acres
              </span>
            </div>
          </div>

          {/* Investment */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Estimated Investment
              <span className="ml-1 text-red-500">*</span>
            </label>

            <div className="relative">
              <IndianRupee
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="number"
                placeholder="120"
                className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-16 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-emerald-600"
              />

              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                Crore
              </span>
            </div>
          </div>

          {/* Employees */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Expected Employees
            </label>

            <div className="relative">
              <Users
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="number"
                placeholder="350"
                className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-emerald-600"
              />
            </div>
          </div>

          {/* Operating hours */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Operating Hours
            </label>

            <div className="relative">
              <Clock3
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="number"
                placeholder="16"
                className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-20 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-emerald-600"
              />

              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                hours/day
              </span>
            </div>
          </div>

          {/* Description */}
          <div className="col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Project Description
            </label>

            <textarea
              rows={4}
              placeholder="Briefly describe the proposed project..."
              className="w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-emerald-600"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900">
            <ArrowLeft size={16} />
            Cancel
          </button>
          <button 
          onClick = {() => navigate("/projects/abc/location")}
            className = "flex items-center gap-2 rounded-md bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-800"
          >
            Continue to Location
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}