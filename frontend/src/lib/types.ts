// Shapes returned by the Express backend. Field names are snake_case because
// these come straight from PostgreSQL rows; request bodies are camelCase
// because that is what the route validators expect. The mismatch is the
// backend's, not a mistake here.
//
// NUMERIC columns arrive as strings over JSON (node-pg does not coerce them,
// to avoid losing precision), so anything that was NUMERIC is typed string.

export type Role =
  | "PROJECT_DEVELOPER"
  | "ENVIRONMENTAL_CONSULTANT"
  | "SUSTAINABILITY_OFFICER"
  | "ADMIN";

export const ROLES: { value: Role; label: string }[] = [
  { value: "ENVIRONMENTAL_CONSULTANT", label: "Environmental consultant" },
  { value: "PROJECT_DEVELOPER", label: "Project developer" },
  { value: "SUSTAINABILITY_OFFICER", label: "Sustainability officer" },
  { value: "ADMIN", label: "Administrator" },
];

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  organization: string | null;
  created_at: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

// Ambient noise limits depend on this, so the user declares it rather than it
// being inferred. Must match AREA_CLASSIFICATIONS in backend projectRoutes.js.
export type AreaClassification =
  | "Industrial"
  | "Commercial"
  | "Residential"
  | "Silence Zone"
  | "Rural/Other";

export const AREA_CLASSIFICATIONS: AreaClassification[] = [
  "Industrial",
  "Commercial",
  "Residential",
  "Silence Zone",
  "Rural/Other",
];

export interface ProjectLocation {
  id: string;
  project_id: string;
  address: string | null;
  city: string | null;
  district: string | null;
  state: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  // NUMERIC, so a string, unlike the two DOUBLE PRECISION columns above.
  elevation_m: string | null;
  area_classification: AreaClassification | null;
  ecologically_sensitive: boolean | null;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  project_type: string | null;
  industry: string;
  description: string | null;
  developer_name: string | null;
  capacity: string | null;
  capacity_unit: string | null;
  land_area: string | null;
  land_area_unit: string | null;
  estimated_investment: string | null;
  employees: number | null;
  // INTEGER above, NUMERIC(5,2) here, so this one arrives as a string while
  // employees arrives as a number.
  operating_hours_per_day: string | null;
  status: string;
  created_at: string;
  updated_at: string;

  // findProjectById returns the joined location as a nested object;
  // findProjectsByUser flattens a few of its columns onto the row instead.
  location?: ProjectLocation | null;
  city?: string | null;
  district?: string | null;
  state?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

// Sent by both POST /api/projects and PUT /api/projects/:id -- the two routes
// share one validator chain on the backend, so one shape serves the create
// and edit forms alike. An optional field set to null clears the stored
// value; omitting it on an update leaves name and industry alone and clears
// everything else, so the form always sends the whole object.
export interface NewProjectRequest {
  project: {
    name: string;
    industry: string;
    projectType?: string | null;
    description?: string | null;
    landArea?: number | null;
    landAreaUnit?: string | null;
    estimatedInvestment?: number | null;
    employees?: number | null;
    operatingHoursPerDay?: number | null;
  };
  location?: {
    address?: string | null;
    city?: string | null;
    district?: string | null;
    state?: string | null;
    country?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    areaClassification?: AreaClassification | null;
    ecologicallySensitive?: boolean | null;
  };
}

// Must match VALID_CATEGORIES in backend assessmentModel.js, which mirrors
// the chk_assessment_inputs_category constraint.
export type Category =
  | "Air"
  | "Water"
  | "Ecology"
  | "Carbon"
  | "Resource"
  | "Waste"
  | "Noise"
  | "Meteorology"
  | "Land"
  | "Soil"
  | "Socio-economic"
  | "Natural Hazards";

export const CATEGORIES: Category[] = [
  "Air",
  "Water",
  "Ecology",
  "Carbon",
  "Resource",
  "Waste",
  "Noise",
  "Meteorology",
  "Land",
  "Soil",
  "Socio-economic",
  "Natural Hazards",
];

export interface Assessment {
  id: string;
  project_id: string;
  assessment_number: number;
  status: string;
  methodology_version: string | null;
  // The calculation engine is not built yet, so these are null on every row.
  overall_score: string | null;
  risk_level: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssessmentInput {
  id: string;
  assessment_id: string;
  category: Category;
  parameter_name: string;
  value_numeric: string | null;
  value_text: string | null;
  unit: string | null;
  source: string | null;
}

export interface NewAssessmentInput {
  category: Category;
  parameterName: string;
  valueNumeric?: number | null;
  valueText?: string | null;
  unit?: string | null;
  source?: string | null;
}

// A row of environmental_data. The provider is recorded three ways: the
// data_sources id, the stable key the analytics service uses, and the name to
// show. metadata carries whatever else the provider returned, including a
// display_name that reads better than parameter_name ("CO", not "co").
export interface ObservationMetadata {
  section?: string;
  data_type?: string;
  source_key?: string;
  display_name?: string;
  api_parameter?: string;
  [key: string]: unknown;
}

export interface Observation {
  id: string;
  assessment_id: string;
  location_id: string | null;
  source_id: string | null;
  source_key: string | null;
  source_name: string | null;
  category: string;
  parameter_name: string;
  value_numeric: string | null;
  value_text: string | null;
  unit: string | null;
  // When the provider says the reading was taken, which is not when it was
  // fetched; an hourly air reading can be an hour old.
  recorded_at: string | null;
  retrieved_at: string;
  metadata: ObservationMetadata | null;
}

export interface GisResult {
  id: string;
  assessment_id: string;
  location_id: string | null;
  feature_type: string;
  feature_name: string | null;
  // Metres, not kilometres.
  distance_m: string | null;
  inside_boundary: boolean | null;
  sensitivity_level: string | null;
  value_numeric: string | null;
  value_text: string | null;
  unit: string | null;
  source: string | null;
  source_reference: string | null;
  analyzed_at: string;
  metadata: Record<string, unknown> | null;
}

export interface FetchLog {
  id: string;
  source_key: string | null;
  source_name: string | null;
  provider: string | null;
  status: string | null;
  record_count: number | null;
  request_parameters: Record<string, unknown> | null;
  response_time_ms: number | null;
  error_message: string | null;
  fetched_at: string;
}

export interface AssessmentDetail extends Assessment {
  inputs: AssessmentInput[];
  environmental_data: Observation[];
  gis_results: GisResult[];
  impact_results: unknown[];
  recommendations: unknown[];
  reports: unknown[];
}

// One entry per external provider the analytics service tried.
export interface ProviderOutcome {
  source_key: string;
  name: string;
  provider: string;
  status: "available" | "unavailable" | "error";
  reason: string | null;
  record_count: number;
  response_time_ms: number | null;
}

export interface EnvironmentalFetchResult {
  assessment_id: string;
  retrieved_at: string;
  duration_ms: number;
  saved: { observations: number; gisResults: number; fetchLogs: number };
  providers: ProviderOutcome[];
  sections: unknown[];
  required_inputs: RequiredInput[];
  warnings: string[];
}

export interface RequiredInput {
  category?: string;
  parameter_name?: string;
  display_name?: string;
  unit?: string | null;
  note?: string | null;
}

export interface StoredEnvironmentalData {
  environmental_data: Observation[];
  gis_results: GisResult[];
  fetch_logs: FetchLog[];
}

export interface Coefficient {
  id: string;
  industry: string;
  factor: string;
  coefficient_code: string;
  coefficient_name: string;
  input_parameter: string | null;
  input_unit: string | null;
  value: string;
  unit: string | null;
  result_unit: string | null;
  source: string;
  reference: string | null;
  verified: boolean;
  active: boolean;
}

export interface Standard {
  id: string;
  category: string;
  parameter_name: string;
  display_name: string | null;
  standard_name: string;
  authority: string | null;
  industry: string;
  basis: string | null;
  zone: string | null;
  averaging_period: string | null;
  limit_type: string;
  limit_value: string | null;
  unit: string | null;
  reference: string | null;
  verified: boolean;
  active: boolean;
}

export interface Rule {
  id: string;
  factor: string;
  rule_code: string;
  rule_name: string;
  description: string | null;
  active: boolean;
}

// ---------------------------------------------------------------------------
// Modules, parameters and calculation results
// ---------------------------------------------------------------------------
//
// These mirror the module-driven calculation schema (migration 007). Nothing
// here names a module: the five that exist today arrive as data from
// /api/modules, and a sixth would appear in the UI without a change to this
// file.

export type ValueType = "numeric" | "text" | "enum";

/** One question the platform puts to the user. */
export interface ModuleParameter {
  module_code: string;
  module_name: string;
  code: string;
  label: string;
  unit: string | null;
  value_type: ValueType;
  enum_values: string[] | null;
  help_text: string | null;
  required: boolean;
  display_order: number;
}

/** One figure a module produces. `formula_text` is shown to the user and is
 *  documentation, not something the frontend evaluates. */
export interface ModuleOutput {
  module_code: string;
  code: string;
  label: string;
  unit: string | null;
  formula_text: string;
  operation: "product" | "sum" | "ratio" | "difference" | "clamped" | "lookup" | "geometry";
  comparable: boolean;
  limitation_note: string | null;
  display_order: number;
}

export interface Module {
  code: string;
  name: string;
  description: string | null;
  purpose: string | null;
  display_order: number;
  enabled: boolean;
  parameters: ModuleParameter[];
  outputs: ModuleOutput[];
}

/** Where a figure came from. A calculation is the same arithmetic whichever
 *  this is, and a report must not let a lab result and an estimate look alike. */
export type SourceStatus =
  | "OFFICIAL_LIVE"
  | "OFFICIAL_REFERENCE"
  | "USER_REPORTED"
  | "USER_DOCUMENTED"
  | "LAB_MEASURED"
  | "GIS_DERIVED"
  | "ESTIMATED"
  | "STALE"
  | "UNAVAILABLE"
  | "UNVERIFIED";

/** A stored answer. node-pg returns NUMERIC as a string, so value_numeric is
 *  a string here and must go through formatValue rather than Number(). */
export interface ParameterValue {
  id: string;
  parameter_code: string;
  value_numeric: string | null;
  value_text: string | null;
  unit: string | null;
  reporting_period: string | null;
  source_status: SourceStatus;
  source_reference: string | null;
  observed_on: string | null;
  method: string | null;
  assumption: string | null;
  updated_at: string;
  label: string;
  module_code: string;
  expected_unit: string | null;
}

export interface NewParameterValue {
  parameterCode: string;
  valueNumeric?: number | null;
  valueText?: string | null;
  unit?: string | null;
  reportingPeriod?: string | null;
  sourceStatus?: SourceStatus;
  sourceReference?: string | null;
  assumption?: string | null;
}

/** Why a result does or does not carry a number. The four NOT_* values are
 *  the reason an absent figure is never shown as zero. */
export type CalculationStatus =
  | "CALCULATED"
  | "NOT_CALCULATED_MISSING_INPUT"
  | "NOT_CALCULATED_UNIT_MISMATCH"
  | "NOT_CALCULATED_NO_FACTOR"
  | "NOT_APPLICABLE"
  | "VERIFICATION_REQUIRED";

export type ComparisonVerdict = "within_limit" | "outside_limit" | "not_compared";

export interface ResultInput {
  code: string;
  label: string | null;
  value: number | null;
  text: string | null;
  unit: string | null;
  source_status: string;
  reporting_period: string | null;
}

export interface ResultConstant {
  code: string;
  label: string;
  value: number;
  unit: string;
  source: string;
  version: string | null;
  verified: boolean;
}

/** The provenance column. It holds the cited constants and limits, the
 *  outputs a derived figure was built from, and the sentence explaining a
 *  calculation that did not happen. */
export interface ResultProvenance {
  constants: ResultConstant[];
  limits: ResultConstant[];
  derived_from: string[];
  detail: string | null;
}

export interface ModuleResult {
  module_code: string;
  module_name: string;
  output_code: string;
  label: string | null;
  operation: string | null;
  value_numeric: string | null;
  value_text: string | null;
  unit: string | null;
  status: CalculationStatus;
  missing_inputs: string[] | null;
  comparison: ComparisonVerdict;
  limit_code: string | null;
  limit_value: string | null;
  limit_unit: string | null;
  inputs_used: ResultInput[] | null;
  constants_used: ResultProvenance | null;
  formula_text: string | null;
  limitation_note: string | null;
  provisional: boolean;
  calculated_at: string;
}

export interface CalculationRun {
  id: string;
  engine_version: string;
  status: "running" | "completed" | "failed";
  summary: Record<string, number | unknown> | null;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  error_message: string | null;
}

export interface CalculationResults {
  run: CalculationRun | null;
  results: ModuleResult[];
  calculated: boolean;
}

/** A seeded constant or limit with its citation, for the reference view. */
export interface ModuleConstant {
  module_code: string;
  code: string;
  label: string;
  value: string;
  unit: string;
  applies_to: string;
  expects_unit: string;
  result_unit: string;
  source: string;
  citation: string;
  source_url: string | null;
  version: string | null;
  verified: boolean;
  notes: string | null;
}

export interface ModuleLimit {
  module_code: string;
  code: string;
  label: string;
  subject: string;
  selector: Record<string, string>;
  comparison: "max" | "min" | "range";
  value: string;
  value_max: string | null;
  unit: string;
  is_index: boolean;
  source: string;
  citation: string;
  source_url: string | null;
  version: string | null;
  verified: boolean;
  notes: string | null;
}
