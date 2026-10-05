import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Clock3,
  IndianRupee,
  Loader2,
  MapPin,
  Ruler,
  Users,
} from "lucide-react";

import { InlineError } from "../components/ui/States";
import { api } from "../lib/api";
import { AREA_CLASSIFICATIONS, type AreaClassification } from "../lib/types";

const PROJECT_TYPES = [
  "Industrial",
  "Infrastructure",
  "Mining",
  "Energy",
  "Construction",
  "Other",
];

// Sector names that match the seeded reference data. The Schedule VI Part-B
// waste water quantums and the IPCC fuel factors are keyed by industry, so a
// free-text industry here would simply find no coefficient later.
const INDUSTRIES = [
  "Sugar",
  "Distillery",
  "Dairy",
  "Textile",
  "Cement",
  "Steel",
  "Pulp and paper",
  "Tanneries",
  "Fertilizer",
  "Food Processing",
  "Pharmaceutical",
  "Chemical Manufacturing",
  "Other Manufacturing",
];

const fieldClass =
  "h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-emerald-600";

const selectClass =
  "h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-600";

// "" rather than 0 so an untouched optional number is sent as null instead of
// being recorded as a real zero.
function toNumberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function CreateProject() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [projectType, setProjectType] = useState("");
  const [industry, setIndustry] = useState("");
  const [landArea, setLandArea] = useState("");
  const [investment, setInvestment] = useState("");
  const [employees, setEmployees] = useState("");
  const [operatingHours, setOperatingHours] = useState("");
  const [description, setDescription] = useState("");

  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("Solapur");
  const [state, setState] = useState("Maharashtra");
  const [areaClassification, setAreaClassification] =
    useState<AreaClassification>("Industrial");
  const [ecologicallySensitive, setEcologicallySensitive] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError("This browser does not provide a location.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(6));
        setLongitude(position.coords.longitude.toFixed(6));
        setLocating(false);
      },
      (positionError) => {
        setError(`Could not read your location: ${positionError.message}`);
        setLocating(false);
      },
      { timeout: 10_000 }
    );
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const lat = toNumberOrNull(latitude);
    const lon = toNumberOrNull(longitude);

    // Checked here because every later step depends on a point: the baseline
    // fetch queries providers by coordinate, and the backend has no endpoint
    // that adds a location to a project after it exists.
    if (lat === null || lon === null) {
      setError("Enter the site latitude and longitude. The environmental baseline is fetched for that point.");
      return;
    }
    if (lat < -90 || lat > 90) {
      setError("Latitude must be between -90 and 90.");
      return;
    }
    if (lon < -180 || lon > 180) {
      setError("Longitude must be between -180 and 180.");
      return;
    }

    setBusy(true);
    try {
      const { project } = await api.createProject({
        project: {
          name: name.trim(),
          industry,
          projectType: projectType || null,
          description: description.trim() || null,
          landArea: toNumberOrNull(landArea),
          landAreaUnit: landArea.trim() ? "acres" : null,
          estimatedInvestment: toNumberOrNull(investment),
          employees: toNumberOrNull(employees),
          operatingHoursPerDay: toNumberOrNull(operatingHours),
        },
        location: {
          latitude: lat,
          longitude: lon,
          city: city.trim() || null,
          district: district.trim() || null,
          state: state.trim() || null,
          country: "India",
          areaClassification,
          ecologicallySensitive,
        },
      });

      navigate(`/projects/${project.id}/location`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the project.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-5xl">
      <div className="mb-7">
        <p className="mb-1 text-sm font-medium text-emerald-700">Projects</p>

        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Create New Project
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Enter the project details and its site. The site is saved with the project, so the
          environmental baseline can be fetched for that point next.
        </p>
      </div>

      <div className="mb-6 border border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-700 text-xs font-semibold text-white">
              1
            </div>
            <span className="text-sm font-medium text-slate-900">Project &amp; Site</span>
          </div>

          <div className="mx-4 h-px flex-1 bg-slate-200" />

          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-xs font-medium text-slate-400">
              2
            </div>
            <span className="text-sm text-slate-400">Environmental Baseline</span>
          </div>

          <div className="mx-4 h-px flex-1 bg-slate-200" />

          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-xs font-medium text-slate-400">
              3
            </div>
            <span className="text-sm text-slate-400">Assessment Inputs</span>
          </div>
        </div>
      </div>

      <div className="border border-slate-200 bg-white">
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
          <div className="col-span-2">
            <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-slate-700">
              Project Name<span className="ml-1 text-red-500">*</span>
            </label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Enter project name"
              className={fieldClass}
            />
          </div>

          <div>
            <label
              htmlFor="projectType"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Project Type
            </label>
            <select
              id="projectType"
              value={projectType}
              onChange={(e) => setProjectType(e.target.value)}
              className={selectClass}
            >
              <option value="">Select project type</option>
              {PROJECT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="industry"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Industry / Sector<span className="ml-1 text-red-500">*</span>
            </label>
            <select
              id="industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              required
              className={selectClass}
            >
              <option value="">Select industry</option>
              {INDUSTRIES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-slate-500">
              Coefficients and sector limits are keyed by industry.
            </p>
          </div>

          <div>
            <label
              htmlFor="landArea"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Project Area
            </label>
            <div className="relative">
              <Ruler
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                id="landArea"
                type="number"
                min="0"
                step="any"
                value={landArea}
                onChange={(e) => setLandArea(e.target.value)}
                placeholder="25"
                className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-16 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-emerald-600"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                acres
              </span>
            </div>
          </div>

          <div>
            <label
              htmlFor="investment"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Estimated Investment
            </label>
            <div className="relative">
              <IndianRupee
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                id="investment"
                type="number"
                min="0"
                step="any"
                value={investment}
                onChange={(e) => setInvestment(e.target.value)}
                placeholder="120"
                className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-16 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-emerald-600"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                Crore
              </span>
            </div>
          </div>

          <div>
            <label
              htmlFor="employees"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Expected Employees
            </label>
            <div className="relative">
              <Users
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                id="employees"
                type="number"
                min="0"
                step="1"
                value={employees}
                onChange={(e) => setEmployees(e.target.value)}
                placeholder="350"
                className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-emerald-600"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="operatingHours"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Operating Hours
            </label>
            <div className="relative">
              <Clock3
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                id="operatingHours"
                type="number"
                min="0"
                max="24"
                step="any"
                value={operatingHours}
                onChange={(e) => setOperatingHours(e.target.value)}
                placeholder="16"
                className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-20 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-emerald-600"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                hours/day
              </span>
            </div>
          </div>

          <div className="col-span-2">
            <label
              htmlFor="description"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Project Description
            </label>
            <textarea
              id="description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Briefly describe the proposed project..."
              className="w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-emerald-600"
            />
          </div>
        </div>

        <div className="border-y border-slate-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center bg-emerald-50 text-emerald-700">
              <MapPin size={18} />
            </div>

            <div>
              <h2 className="text-sm font-semibold text-slate-900">Site Location</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Saved with the project in one step. Every provider is queried by this point.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-5 p-6">
          <div>
            <label
              htmlFor="latitude"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Latitude<span className="ml-1 text-red-500">*</span>
            </label>
            <input
              id="latitude"
              type="number"
              step="any"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              placeholder="17.6599"
              className={fieldClass}
            />
          </div>

          <div>
            <label
              htmlFor="longitude"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Longitude<span className="ml-1 text-red-500">*</span>
            </label>
            <input
              id="longitude"
              type="number"
              step="any"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              placeholder="75.9064"
              className={fieldClass}
            />
          </div>

          <div className="col-span-2">
            <button
              type="button"
              onClick={useCurrentLocation}
              disabled={locating}
              className="flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {locating ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
              Use current location
            </button>
          </div>

          <div>
            <label htmlFor="city" className="mb-1.5 block text-sm font-medium text-slate-700">
              City / Town
            </label>
            <input
              id="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Solapur"
              className={fieldClass}
            />
          </div>

          <div>
            <label
              htmlFor="district"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              District
            </label>
            <input
              id="district"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className={fieldClass}
            />
            <p className="mt-1.5 text-xs text-slate-500">
              The published baseline is collected for Solapur district.
            </p>
          </div>

          <div>
            <label htmlFor="state" className="mb-1.5 block text-sm font-medium text-slate-700">
              State
            </label>
            <input
              id="state"
              value={state}
              onChange={(e) => setState(e.target.value)}
              className={fieldClass}
            />
          </div>

          <div>
            <label
              htmlFor="areaClassification"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Area Classification<span className="ml-1 text-red-500">*</span>
            </label>
            <select
              id="areaClassification"
              value={areaClassification}
              onChange={(e) => setAreaClassification(e.target.value as AreaClassification)}
              className={selectClass}
            >
              {AREA_CLASSIFICATIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-slate-500">
              Ambient noise limits depend on this, so it is declared rather than guessed.
            </p>
          </div>

          <div className="col-span-2">
            <label className="flex items-start gap-2.5">
              <input
                type="checkbox"
                checked={ecologicallySensitive}
                onChange={(e) => setEcologicallySensitive(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
              />
              <span className="text-sm text-slate-700">
                The site is in an ecologically sensitive area
                <span className="mt-0.5 block text-xs text-slate-500">
                  Air quality is compared against the stricter ecologically sensitive limits
                  where the notification sets them.
                </span>
              </span>
            </label>
          </div>
        </div>

        {error && (
          <div className="px-6 pb-5">
            <InlineError message={error} />
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={() => navigate("/projects")}
            className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft size={16} />
            Cancel
          </button>

          <button
            type="submit"
            disabled={busy}
            className="flex items-center gap-2 rounded-md bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy && <Loader2 size={15} className="animate-spin" />}
            Create project
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </form>
  );
}
