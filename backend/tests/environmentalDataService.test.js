const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildAnalyticsRequest,
  toDataSources,
  toEnvironmentalRows,
  toGisRows,
  toFetchLogs,
} = require("../src/services/environmentalDataService");

const PROVIDERS = [
  {
    source_key: "cpcb_ogd",
    name: "CPCB Real-time AQI (data.gov.in)",
    provider: "CPCB / India OGD",
    source_type: "api",
    endpoint: "https://api.data.gov.in/resource/x",
    status: "error",
    reason: "HTTP 502 from api.data.gov.in",
    record_count: 0,
    response_time_ms: 60012,
    request_parameters: { latitude: 28.6, longitude: 77.2 },
  },
  {
    source_key: "osm_overpass",
    name: "OpenStreetMap Overpass API",
    provider: "OpenStreetMap",
    source_type: "gis_api",
    status: "available",
    reason: null,
    record_count: 1,
    response_time_ms: 800,
    request_parameters: { radius_m: 25000 },
  },
];

test("buildAnalyticsRequest sends location, project and inputs with numbers parsed", () => {
  const context = {
    project_id: "p-1",
    name: "Cement plant",
    industry: "Cement",
    project_type: null,
    capacity: "1000000.00", // node-pg returns NUMERIC as strings
    capacity_unit: "t/year",
    land_area: "12.50",
    land_area_unit: "ha",
    employees: 250,
    operating_hours_per_day: "24.00",
    location_id: "l-1",
    address: null,
    city: "New Delhi",
    district: null,
    state: "Delhi",
    country: "India",
    latitude: 28.6139,
    longitude: 77.209,
    area_classification: "Industrial",
    ecologically_sensitive: false,
  };
  const inputs = [
    { category: "Noise", parameter_name: "leq_day", value_numeric: "55.0000", value_text: null, unit: "dB(A)", source: "consultant" },
    { category: "Waste", parameter_name: "disposal_method", value_numeric: null, value_text: "Landfill", unit: null, source: null },
  ];

  const request = buildAnalyticsRequest({ assessmentId: "a-1", context, inputs, radiusKm: undefined });

  assert.deepEqual(request, {
    assessment_id: "a-1",
    radius_km: null,
    location: {
      latitude: 28.6139,
      longitude: 77.209,
      address: null,
      city: "New Delhi",
      district: null,
      state: "Delhi",
      country: "India",
      area_classification: "Industrial",
      ecologically_sensitive: false,
    },
    project: {
      id: "p-1",
      name: "Cement plant",
      industry: "Cement",
      project_type: null,
      capacity: 1000000,
      capacity_unit: "t/year",
      land_area: 12.5,
      land_area_unit: "ha",
      employees: 250,
      operating_hours_per_day: 24,
    },
    assessment_inputs: [
      { category: "Noise", parameter_name: "leq_day", value_numeric: 55, value_text: null, unit: "dB(A)", source: "consultant" },
      { category: "Waste", parameter_name: "disposal_method", value_numeric: null, value_text: "Landfill", unit: null, source: null },
    ],
  });
});

test("toEnvironmentalRows keeps the parameter key and moves descriptive fields into metadata", () => {
  const [row] = toEnvironmentalRows([
    {
      section: "air_quality",
      category: "Air",
      parameter: "pm25",
      parameter_name: "PM2.5",
      value_numeric: 31.43,
      value_text: null,
      unit: "µg/m³",
      recorded_at: "2026-09-08T14:30:00Z",
      source_key: "openaq",
      data_type: "observed",
      metadata: { station_id: 6254594 },
    },
  ]);

  assert.deepEqual(row, {
    source_key: "openaq",
    category: "Air",
    parameter_name: "pm25",
    value_numeric: 31.43,
    value_text: null,
    unit: "µg/m³",
    recorded_at: "2026-09-08T14:30:00Z",
    metadata: { station_id: 6254594, display_name: "PM2.5", section: "air_quality", data_type: "observed", source_key: "openaq" },
  });
});

test("toGisRows stores the provider name as source and the key in metadata", () => {
  const [row] = toGisRows(
    [
      {
        section: "ecology",
        feature_type: "nearest_river",
        feature_name: "Yamuna",
        distance_m: 4120.5,
        inside_boundary: false,
        sensitivity_level: null,
        value_numeric: null,
        value_text: null,
        unit: null,
        source_key: "osm_overpass",
        source_reference: "osm:way/1",
        metadata: { found: true },
      },
    ],
    PROVIDERS
  );

  assert.equal(row.source, "OpenStreetMap Overpass API");
  assert.equal(row.distance_m, 4120.5);
  assert.deepEqual(row.metadata, { found: true, section: "ecology", source_key: "osm_overpass" });
});

test("toFetchLogs and toDataSources record every provider outcome", () => {
  assert.deepEqual(toFetchLogs(PROVIDERS)[0], {
    source_key: "cpcb_ogd",
    request_parameters: { latitude: 28.6, longitude: 77.2 },
    status: "error",
    response_time_ms: 60012,
    record_count: 0,
    error_message: "HTTP 502 from api.data.gov.in",
  });
  assert.deepEqual(
    toDataSources(PROVIDERS).map((source) => [source.source_key, source.endpoint]),
    [["cpcb_ogd", "https://api.data.gov.in/resource/x"], ["osm_overpass", null]]
  );
});
