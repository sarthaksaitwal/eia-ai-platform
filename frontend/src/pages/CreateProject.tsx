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
  "h-10 w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink outline-none placeholder:text-ink-subtle focus:border-brand focus:ring-2 focus:ring-brand/20";

const selectClass =
  "h-10 w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

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
      <div className="mb-6">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand">
          Projects
        </p>

        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
          Create a new project
        </h1>

        <p className="mt-1 text-sm text-ink-muted">
          Enter the project details and its site. The site is saved with the project, so the
          environmental baseline can be fetched for that point next.
        </p>
      </div>

      {/* Where this form sits in the whole flow. Only the current step's label
          shows on a narrow screen -- three labels and two rules in a 375px row
          squashes every one of them to an ellipsis. */}
      <ol
        aria-label="Progress"
        className="mb-5 flex items-center rounded-lg border border-line bg-surface px-4 py-3.5 sm:px-6"
      >
        {[
          { n: 1, label: "Project and site", current: true },
          { n: 2, label: "Environmental baseline", current: false },
          { n: 3, label: "Assessment inputs", current: false },
        ].map((step, index) => (
          <li key={step.n} className="flex min-w-0 flex-1 items-center last:flex-none">
            <span
              className="flex items-center gap-2"
              aria-current={step.current ? "step" : undefined}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  step.current
                    ? "bg-brand text-ink-inverse"
                    : "border border-line-strong text-ink-subtle"
                }`}
              >
                {step.n}
              </span>

              <span
                className={`truncate text-sm ${
                  step.current
                    ? "font-semibold text-ink"
                    : "hidden text-ink-subtle sm:inline"
                }`}
              >
                {step.label}
              </span>
            </span>

            {index < 2 && <span className="mx-3 h-px flex-1 bg-line sm:mx-4" />}
          </li>
        ))}
      </ol>

      <div className="rounded-lg border border-line bg-surface">
        <div className="border-b border-line px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-soft text-brand-ink">
              <Building2 size={18} />
            </div>

            <div>
              <h2 className="text-sm font-semibold text-ink">
                Basic project information
              </h2>
              <p className="mt-0.5 text-xs text-ink-muted">
                Provide general information about the proposed project.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-x-6 gap-y-5 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="name" className="mb-1.5 block text-sm font-semibold text-ink">
              Project name<span className="ml-1 text-risk">*</span>
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
              className="mb-1.5 block text-sm font-semibold text-ink"
            >
              Project type
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
              className="mb-1.5 block text-sm font-semibold text-ink"
            >
              Industry / Sector<span className="ml-1 text-risk">*</span>
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
            <p className="mt-1.5 text-xs text-ink-muted">
              Coefficients and sector limits are keyed by industry.
            </p>
          </div>

          <div>
            <label
              htmlFor="landArea"
              className="mb-1.5 block text-sm font-semibold text-ink"
            >
              Project area
            </label>
            <div className="relative">
              <Ruler
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"
              />
              <input
                id="landArea"
                type="number"
                min="0"
                step="any"
                value={landArea}
                onChange={(e) => setLandArea(e.target.value)}
                placeholder="25"
                className="h-10 w-full rounded-md border border-line-strong bg-surface pl-9 pr-16 text-sm text-ink outline-none placeholder:text-ink-subtle focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-subtle">
                acres
              </span>
            </div>
          </div>

          <div>
            <label
              htmlFor="investment"
              className="mb-1.5 block text-sm font-semibold text-ink"
            >
              Estimated investment
            </label>
            <div className="relative">
              <IndianRupee
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"
              />
              <input
                id="investment"
                type="number"
                min="0"
                step="any"
                value={investment}
                onChange={(e) => setInvestment(e.target.value)}
                placeholder="120"
                className="h-10 w-full rounded-md border border-line-strong bg-surface pl-9 pr-16 text-sm text-ink outline-none placeholder:text-ink-subtle focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-subtle">
                Crore
              </span>
            </div>
          </div>

          <div>
            <label
              htmlFor="employees"
              className="mb-1.5 block text-sm font-semibold text-ink"
            >
              Expected employees
            </label>
            <div className="relative">
              <Users
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"
              />
              <input
                id="employees"
                type="number"
                min="0"
                step="1"
                value={employees}
                onChange={(e) => setEmployees(e.target.value)}
                placeholder="350"
                className="h-10 w-full rounded-md border border-line-strong bg-surface pl-9 text-sm text-ink outline-none placeholder:text-ink-subtle focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="operatingHours"
              className="mb-1.5 block text-sm font-semibold text-ink"
            >
              Operating hours
            </label>
            <div className="relative">
              <Clock3
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"
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
                className="h-10 w-full rounded-md border border-line-strong bg-surface pl-9 pr-20 text-sm text-ink outline-none placeholder:text-ink-subtle focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-subtle">
                hours/day
              </span>
            </div>
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="description"
              className="mb-1.5 block text-sm font-semibold text-ink"
            >
              Project description
            </label>
            <textarea
              id="description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Briefly describe the proposed project..."
              className="w-full resize-none rounded-md border border-line-strong bg-surface px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink-subtle focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>
        </div>

        <div className="border-y border-line px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-soft text-brand-ink">
              <MapPin size={18} />
            </div>

            <div>
              <h2 className="text-sm font-semibold text-ink">Site location</h2>
              <p className="mt-0.5 text-xs text-ink-muted">
                Saved with the project in one step. Every provider is queried by this point.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-x-6 gap-y-5 p-5 sm:grid-cols-2">
          <div>
            <label
              htmlFor="latitude"
              className="mb-1.5 block text-sm font-semibold text-ink"
            >
              Latitude<span className="ml-1 text-risk">*</span>
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
              className="mb-1.5 block text-sm font-semibold text-ink"
            >
              Longitude<span className="ml-1 text-risk">*</span>
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

          <div className="sm:col-span-2">
            <button
              type="button"
              onClick={useCurrentLocation}
              disabled={locating}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-line-strong bg-surface px-4 text-sm font-semibold text-ink transition-colors duration-200 hover:bg-surface-hover disabled:pointer-events-none disabled:opacity-55"
            >
              {locating ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
              Use current location
            </button>
          </div>

          <div>
            <label htmlFor="city" className="mb-1.5 block text-sm font-semibold text-ink">
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
              className="mb-1.5 block text-sm font-semibold text-ink"
            >
              District
            </label>
            <input
              id="district"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className={fieldClass}
            />
            <p className="mt-1.5 text-xs text-ink-muted">
              The published baseline is collected for Solapur district.
            </p>
          </div>

          <div>
            <label htmlFor="state" className="mb-1.5 block text-sm font-semibold text-ink">
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
              className="mb-1.5 block text-sm font-semibold text-ink"
            >
              Area classification<span className="ml-1 text-risk">*</span>
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
            <p className="mt-1.5 text-xs text-ink-muted">
              Ambient noise limits depend on this, so it is declared rather than guessed.
            </p>
          </div>

          <div className="sm:col-span-2">
            <label className="flex items-start gap-2.5">
              <input
                type="checkbox"
                checked={ecologicallySensitive}
                onChange={(e) => setEcologicallySensitive(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-line-strong text-brand focus:ring-brand"
              />
              <span className="text-sm text-ink">
                The site is in an ecologically sensitive area
                <span className="mt-0.5 block text-xs text-ink-muted">
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

        <div className="flex items-center justify-between border-t border-line bg-surface-sunken px-6 py-4">
          <button
            type="button"
            onClick={() => navigate("/projects")}
            className="flex items-center gap-2 text-sm font-semibold text-ink-muted hover:text-ink"
          >
            <ArrowLeft size={16} />
            Cancel
          </button>

          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-brand px-5 text-sm font-semibold text-ink-inverse transition-colors duration-200 hover:bg-brand-hover active:bg-brand-active disabled:pointer-events-none disabled:opacity-55"
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
