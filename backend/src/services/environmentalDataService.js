const { ApiError } = require("../middleware/errorHandler");
const { fetchEnvironmentalData, AnalyticsServiceError } = require("../clients/analyticsClient");
const assessmentModel = require("../models/assessmentModel");
const environmentalDataModel = require("../models/environmentalDataModel");

// node-pg returns NUMERIC columns as strings.
function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

// Request body for FastAPI POST /api/environmental/fetch: the site location,
// the project context and every assessment input entered so far.
function buildAnalyticsRequest({ assessmentId, context, inputs, radiusKm }) {
  return {
    assessment_id: assessmentId,
    radius_km: radiusKm ?? null,
    location: {
      latitude: toNumber(context.latitude),
      longitude: toNumber(context.longitude),
      address: context.address ?? null,
      city: context.city ?? null,
      district: context.district ?? null,
      state: context.state ?? null,
      country: context.country ?? null,
      area_classification: context.area_classification ?? null,
      ecologically_sensitive: context.ecologically_sensitive ?? null,
    },
    project: {
      id: context.project_id,
      name: context.name ?? null,
      industry: context.industry ?? null,
      project_type: context.project_type ?? null,
      capacity: toNumber(context.capacity),
      capacity_unit: context.capacity_unit ?? null,
      land_area: toNumber(context.land_area),
      land_area_unit: context.land_area_unit ?? null,
      employees: context.employees ?? null,
      operating_hours_per_day: toNumber(context.operating_hours_per_day),
    },
    assessment_inputs: inputs.map((input) => ({
      category: input.category,
      parameter_name: input.parameter_name,
      value_numeric: toNumber(input.value_numeric),
      value_text: input.value_text ?? null,
      unit: input.unit ?? null,
      source: input.source ?? null,
    })),
  };
}

function toDataSources(providers) {
  return providers.map((provider) => ({
    source_key: provider.source_key,
    name: provider.name,
    provider: provider.provider,
    source_type: provider.source_type,
    endpoint: provider.endpoint ?? null,
  }));
}

// observation -> environmental_data. parameter_name keeps the stable key
// (e.g. "pm25"); the display name, catalogue section and data type
// (observed / modelled / reanalysis ...) are kept in metadata.
function toEnvironmentalRows(observations) {
  return observations.map((observation) => ({
    source_key: observation.source_key,
    category: observation.category,
    parameter_name: observation.parameter,
    value_numeric: observation.value_numeric ?? null,
    value_text: observation.value_text ?? null,
    unit: observation.unit ?? null,
    recorded_at: observation.recorded_at ?? null,
    metadata: {
      ...observation.metadata,
      display_name: observation.parameter_name,
      section: observation.section,
      data_type: observation.data_type,
      source_key: observation.source_key,
    },
  }));
}

// gis_feature -> gis_analysis_results. The table has no source_id, so the
// provider name goes in `source` and the stable key in metadata.
function toGisRows(features, providers) {
  const names = Object.fromEntries(providers.map((provider) => [provider.source_key, provider.name]));
  return features.map((feature) => ({
    feature_type: feature.feature_type,
    feature_name: feature.feature_name ?? null,
    distance_m: feature.distance_m ?? null,
    inside_boundary: feature.inside_boundary ?? null,
    sensitivity_level: feature.sensitivity_level ?? null,
    value_numeric: feature.value_numeric ?? null,
    value_text: feature.value_text ?? null,
    unit: feature.unit ?? null,
    source: names[feature.source_key] ?? feature.source_key,
    source_reference: feature.source_reference ?? null,
    metadata: { ...feature.metadata, section: feature.section, source_key: feature.source_key },
  }));
}

function toFetchLogs(providers) {
  return providers.map((provider) => ({
    source_key: provider.source_key,
    request_parameters: provider.request_parameters ?? {},
    status: provider.status,
    response_time_ms: provider.response_time_ms ?? null,
    record_count: provider.record_count ?? null,
    error_message: provider.reason ?? null,
  }));
}

// Sends the assessment's site, project and inputs to the analytics service and
// stores the observations, GIS results and provider outcomes it returns.
async function fetchAndStoreEnvironmentalData({ assessmentId, radiusKm }) {
  const context = await environmentalDataModel.getAssessmentContext(assessmentId);
  if (!context) throw new ApiError(404, "Assessment not found.");
  if (context.latitude == null || context.longitude == null) {
    throw new ApiError(422, "The project has no latitude/longitude. Add the site location before fetching environmental data.");
  }
  const inputs = await assessmentModel.listAssessmentInputs(assessmentId);

  let result;
  try {
    result = await fetchEnvironmentalData(buildAnalyticsRequest({ assessmentId, context, inputs, radiusKm }));
  } catch (err) {
    if (!(err instanceof AnalyticsServiceError)) throw err;
    console.error("Environmental data fetch failed:", err.message, err.detail ?? "");
    throw new ApiError(502, err.message);
  }

  const saved = await environmentalDataModel.saveFetchResult({
    assessmentId,
    locationId: context.location_id,
    retrievedAt: result.retrieved_at,
    dataSources: toDataSources(result.providers),
    observations: toEnvironmentalRows(result.observations),
    gisResults: toGisRows(result.gis_features, result.providers),
    fetchLogs: toFetchLogs(result.providers),
  });

  // sections and required_inputs are not stored; they describe this fetch.
  return {
    assessment_id: assessmentId,
    retrieved_at: result.retrieved_at,
    duration_ms: result.duration_ms,
    saved,
    providers: result.providers,
    sections: result.sections,
    required_inputs: result.required_inputs,
    warnings: result.warnings,
  };
}

module.exports = {
  fetchAndStoreEnvironmentalData,
  buildAnalyticsRequest,
  toDataSources,
  toEnvironmentalRows,
  toGisRows,
  toFetchLogs,
};
