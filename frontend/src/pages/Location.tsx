import { useCallback, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { MapContainer, Marker, TileLayer } from "react-leaflet";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Database,
  Loader2,
  MapPin,
  Radar,
  RefreshCw,
  XCircle,
} from "lucide-react";
import "leaflet/dist/leaflet.css";

import { Empty, ErrorState, InlineError, Loading } from "../components/ui/States";
import { api } from "../lib/api";
import { useApi } from "../lib/useApi";
import type { Observation, ProviderOutcome } from "../lib/types";

// Leaflet's default marker points at images bundled next to its CSS, which a
// bundler rewrites and then cannot find. A divIcon needs no image at all.
import L from "leaflet";

const siteIcon = L.divIcon({
  className: "",
  html: '<span style="display:block;width:14px;height:14px;border-radius:9999px;background:#047857;box-shadow:0 0 0 4px rgba(4,120,87,0.25)"></span>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function providerIcon(status: ProviderOutcome["status"]) {
  if (status === "available") return <CheckCircle2 size={15} className="text-emerald-600" />;
  if (status === "unavailable") return <AlertTriangle size={15} className="text-amber-600" />;
  return <XCircle size={15} className="text-red-600" />;
}

// NUMERIC columns arrive as strings; a value may also be text ("semi_critical")
// rather than a number, so both carry through unchanged.
function observationValue(row: Observation) {
  if (row.value_numeric !== null) {
    const asNumber = Number(row.value_numeric);
    const shown = Number.isFinite(asNumber) ? String(Number(asNumber.toFixed(4))) : row.value_numeric;
    return row.unit ? `${shown} ${row.unit}` : shown;
  }
  if (row.value_text !== null) return row.value_text;
  return "—";
}

export default function Location() {
  const { id: projectId } = useParams<{ id: string }>();

  const project = useApi(
    () => (projectId ? api.getProject(projectId) : Promise.reject(new Error("No project."))),
    [projectId]
  );

  const assessments = useApi(
    () => (projectId ? api.listAssessments(projectId) : Promise.reject(new Error("No project."))),
    [projectId]
  );

  // The newest assessment is the one being worked on. assessment_number
  // increments per project, so the highest is the latest.
  const assessment = useMemo(() => {
    const list = assessments.data?.assessments ?? [];
    if (!list.length) return null;
    return [...list].sort((a, b) => b.assessment_number - a.assessment_number)[0];
  }, [assessments.data]);

  const stored = useApi(
    () =>
      assessment
        ? api.getEnvironmentalData(assessment.id)
        : Promise.resolve({ environmental_data: [], gis_results: [], fetch_logs: [] }),
    [assessment?.id]
  );

  const [radiusKm, setRadiusKm] = useState("10");
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProviderOutcome[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [creatingAssessment, setCreatingAssessment] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const createAssessment = useCallback(async () => {
    if (!projectId) return;
    setCreatingAssessment(true);
    setFetchError(null);
    try {
      await api.createAssessment(projectId);
      assessments.reload();
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Could not start an assessment.");
    } finally {
      setCreatingAssessment(false);
    }
  }, [projectId, assessments]);

  const runFetch = useCallback(async () => {
    if (!assessment) return;

    const radius = Number(radiusKm);
    if (!Number.isFinite(radius) || radius <= 0 || radius > 25) {
      setFetchError("Radius must be greater than 0 and at most 25 km.");
      return;
    }

    setFetching(true);
    setFetchError(null);
    setProviders(null);
    setWarnings([]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await api.fetchEnvironmentalData(assessment.id, radius, controller.signal);
      setProviders(result.providers);
      setWarnings(result.warnings ?? []);
      stored.reload();
      assessments.reload();
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "The baseline fetch failed.");
    } finally {
      setFetching(false);
      abortRef.current = null;
    }
  }, [assessment, radiusKm, stored, assessments]);

  if (project.loading) return <Loading label="Loading the project..." />;
  if (project.error) return <ErrorState message={project.error} onRetry={project.reload} />;
  if (!project.data) return <ErrorState message="Project not found." />;

  const { project: row } = project.data;
  const location = row.location ?? null;
  const lat = location?.latitude ? Number(location.latitude) : null;
  const lon = location?.longitude ? Number(location.longitude) : null;
  const hasPoint = lat !== null && lon !== null && Number.isFinite(lat) && Number.isFinite(lon);

  const observations = stored.data?.environmental_data ?? [];
  const gisResults = stored.data?.gis_results ?? [];

  const byCategory = observations.reduce<Record<string, Observation[]>>((acc, obs) => {
    (acc[obs.category] ??= []).push(obs);
    return acc;
  }, {});

  return (
    <div className="max-w-6xl">
      <div className="mb-7">
        <p className="mb-1 text-sm font-medium text-emerald-700">Assessment Setup</p>

        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Location &amp; GIS</h1>

        <p className="mt-1 text-sm text-slate-500">
          {row.name} — review the site and collect the environmental baseline for it.
        </p>
      </div>

      {/* Site */}
      <section className="mb-6 border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center bg-emerald-50 text-emerald-700">
              <MapPin size={18} />
            </div>

            <div>
              <h2 className="text-sm font-semibold text-slate-900">Project Site</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Saved when the project was created.
              </p>
            </div>
          </div>
        </div>

        {!hasPoint ? (
          <div className="p-6">
            <InlineError
              message="This project has no coordinates, so no baseline can be fetched. The backend sets a location only when the project is created, so this project needs to be created again with its site."
            />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-6 p-6">
            <div className="col-span-2 overflow-hidden rounded-md border border-slate-200">
              <MapContainer
                center={[lat, lon]}
                zoom={12}
                scrollWheelZoom={false}
                style={{ height: 280, width: "100%" }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={[lat, lon]} icon={siteIcon} />
              </MapContainer>
            </div>

            <dl className="space-y-3.5 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">Latitude</dt>
                <dd className="mt-0.5 text-slate-800">{lat.toFixed(6)}</dd>
              </div>

              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">Longitude</dt>
                <dd className="mt-0.5 text-slate-800">{lon.toFixed(6)}</dd>
              </div>

              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">Place</dt>
                <dd className="mt-0.5 text-slate-800">
                  {[location?.city, location?.district, location?.state]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </dd>
              </div>

              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">
                  Area classification
                </dt>
                <dd className="mt-0.5 text-slate-800">
                  {location?.area_classification || "Not set"}
                </dd>
              </div>

              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">
                  Ecologically sensitive
                </dt>
                <dd className="mt-0.5 text-slate-800">
                  {location?.ecologically_sensitive ? "Yes" : "No"}
                </dd>
              </div>

              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">Industry</dt>
                <dd className="mt-0.5 text-slate-800">{row.industry}</dd>
              </div>
            </dl>
          </div>
        )}
      </section>

      {/* Assessment */}
      <section className="mb-6 border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center bg-emerald-50 text-emerald-700">
              <ClipboardCheck size={18} />
            </div>

            <div>
              <h2 className="text-sm font-semibold text-slate-900">Assessment</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Baseline data and inputs belong to an assessment, not to the project.
              </p>
            </div>
          </div>

          {assessment && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
              {assessment.status}
            </span>
          )}
        </div>

        <div className="p-6">
          {assessments.loading && <p className="text-sm text-slate-500">Loading assessments...</p>}

          {assessments.error && (
            <ErrorState message={assessments.error} onRetry={assessments.reload} />
          )}

          {!assessments.loading && !assessments.error && !assessment && (
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-slate-600">
                No assessment started for this project yet.
              </p>

              <button
                onClick={createAssessment}
                disabled={creatingAssessment}
                className="flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-800 disabled:opacity-60"
              >
                {creatingAssessment && <Loader2 size={15} className="animate-spin" />}
                Start assessment
              </button>
            </div>
          )}

          {assessment && (
            <dl className="grid grid-cols-3 gap-6 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">Assessment</dt>
                <dd className="mt-0.5 text-slate-800">#{assessment.assessment_number}</dd>
              </div>

              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">Started</dt>
                <dd className="mt-0.5 text-slate-800">
                  {new Date(assessment.created_at).toLocaleString()}
                </dd>
              </div>

              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">Inputs recorded</dt>
                <dd className="mt-0.5 text-slate-800">
                  {/* Entering inputs is the next screen to build. */}
                  Not entered yet
                </dd>
              </div>
            </dl>
          )}
        </div>
      </section>

      {/* Environmental baseline */}
      <section className="mb-6 border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center bg-emerald-50 text-emerald-700">
              <Radar size={18} />
            </div>

            <div>
              <h2 className="text-sm font-semibold text-slate-900">Environmental Baseline</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Collected from public providers for this point. Takes one to four minutes.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {!assessment ? (
            <p className="text-sm text-slate-500">Start an assessment first.</p>
          ) : (
            <>
              <div className="mb-5 flex flex-wrap items-end gap-4">
                <div>
                  <label
                    htmlFor="radius"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Search radius
                  </label>
                  <div className="relative w-36">
                    <input
                      id="radius"
                      type="number"
                      min="1"
                      max="25"
                      step="any"
                      value={radiusKm}
                      onChange={(e) => setRadiusKm(e.target.value)}
                      disabled={fetching}
                      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 pr-10 text-sm text-slate-800 outline-none focus:border-emerald-600 disabled:bg-slate-50"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                      km
                    </span>
                  </div>
                </div>

                <button
                  onClick={runFetch}
                  disabled={fetching || !hasPoint}
                  className="flex h-10 items-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-medium text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {fetching ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <RefreshCw size={15} />
                  )}
                  {observations.length ? "Fetch again" : "Fetch baseline"}
                </button>

                {fetching && (
                  <button
                    onClick={() => abortRef.current?.abort()}
                    className="h-10 rounded-md border border-slate-200 px-4 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                )}

                {fetching && (
                  <p className="text-sm text-slate-500">
                    Querying providers. This runs for one to four minutes — leaving this page
                    does not stop the backend.
                  </p>
                )}
              </div>

              {fetchError && (
                <div className="mb-5">
                  <InlineError message={fetchError} />
                </div>
              )}

              {warnings.map((warning) => (
                <div
                  key={warning}
                  className="mb-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900"
                >
                  <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-600" />
                  {warning}
                </div>
              ))}

              {providers && (
                <div className="mb-6 overflow-hidden rounded-md border border-slate-200">
                  <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Providers ({providers.filter((p) => p.status === "available").length} of{" "}
                    {providers.length} available)
                  </div>

                  {providers.map((outcome, index) => (
                    <div
                      key={`${outcome.source_key}-${index}`}
                      className="flex items-start gap-3 border-b border-slate-100 px-4 py-2.5 last:border-b-0"
                    >
                      <span className="mt-0.5">{providerIcon(outcome.status)}</span>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-800">{outcome.name}</p>
                        {outcome.reason && (
                          <p className="mt-0.5 text-xs text-slate-500">{outcome.reason}</p>
                        )}
                      </div>

                      <span className="shrink-0 text-xs text-slate-400">
                        {outcome.record_count} record{outcome.record_count === 1 ? "" : "s"}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {stored.loading && <p className="text-sm text-slate-500">Loading stored data...</p>}

              {stored.error && <ErrorState message={stored.error} onRetry={stored.reload} />}

              {!stored.loading && !stored.error && observations.length === 0 && !fetching && (
                <Empty
                  title="No baseline collected yet"
                  hint="Fetching queries air quality, weather, soil, hydrology, population and protected-area providers for this point and stores what they return."
                />
              )}

              {observations.length > 0 && (
                <>
                  <div className="mb-5 grid grid-cols-3 gap-4">
                    {[
                      { label: "Observations", value: observations.length, icon: Database },
                      { label: "GIS features", value: gisResults.length, icon: MapPin },
                      {
                        label: "Categories",
                        value: Object.keys(byCategory).length,
                        icon: ClipboardCheck,
                      },
                    ].map((card) => (
                      <div
                        key={card.label}
                        className="flex items-center gap-3 rounded-md border border-slate-200 px-4 py-3"
                      >
                        <card.icon size={17} className="text-emerald-700" />
                        <div>
                          <div className="text-lg font-semibold text-slate-900">{card.value}</div>
                          <div className="text-xs text-slate-500">{card.label}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-4">
                    {Object.entries(byCategory)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([category, rows]) => (
                        <div
                          key={category}
                          className="overflow-hidden rounded-md border border-slate-200"
                        >
                          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              {category}
                            </span>
                            <span className="text-xs text-slate-400">{rows.length}</span>
                          </div>

                          {rows.map((obs) => (
                            <div
                              key={obs.id}
                              className="grid grid-cols-[1.6fr_1fr_1fr] items-center gap-3 border-b border-slate-100 px-4 py-2.5 last:border-b-0"
                            >
                              <span className="truncate text-sm text-slate-700">
                                {obs.metadata?.display_name || obs.parameter_name}
                              </span>
                              <span className="text-sm font-medium text-slate-900">
                                {observationValue(obs)}
                              </span>
                              <span className="truncate text-xs text-slate-400">
                                {obs.source_name || "—"}
                              </span>
                            </div>
                          ))}
                        </div>
                      ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </section>

      <div className="flex items-center justify-between">
        <Link
          to="/projects"
          className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft size={16} />
          Back to projects
        </Link>

        {/* Assessment inputs and the calculation engine are the next phases. */}
        <span className="text-sm text-slate-400">Assessment inputs come next</span>
      </div>
    </div>
  );
}
