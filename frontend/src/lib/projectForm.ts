import { AREA_CLASSIFICATIONS, type AreaClassification } from "./types";
import type { NewProjectRequest, Project } from "./types";

/* ---------------------------------------------------------------------------
   The project form's state, shared by the create and edit screens.

   Every numeric field is held as a string, because that is what an <input>
   holds. The distinction matters: "" means the person has not entered a
   figure and the field is sent as null, whereas "0" is a real zero they typed.
   Parsing on change instead would collapse the two, and a project would end up
   recording an area of nought acres because a digit was deleted.

   These helpers live outside the component file on purpose -- a module that
   exports anything other than components loses React Fast Refresh for
   everything in it, the same reason fieldStyles.ts is its own file.
--------------------------------------------------------------------------- */

export interface ProjectFormValues {
  name: string;
  projectType: string;
  industry: string;
  landArea: string;
  investment: string;
  employees: string;
  operatingHours: string;
  description: string;

  latitude: string;
  longitude: string;
  city: string;
  district: string;
  state: string;
  areaClassification: AreaClassification;
  ecologicallySensitive: boolean;
}

export const PROJECT_TYPES = [
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
export const INDUSTRIES = [
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

/** A new project starts in Solapur, because that is the district the
 *  published baseline was collected for. */
export const EMPTY_PROJECT_FORM: ProjectFormValues = {
  name: "",
  projectType: "",
  industry: "",
  landArea: "",
  investment: "",
  employees: "",
  operatingHours: "",
  description: "",

  latitude: "",
  longitude: "",
  city: "",
  district: "Solapur",
  state: "Maharashtra",
  areaClassification: "Industrial",
  ecologicallySensitive: false,
};

/** NUMERIC columns arrive as strings ("70.00"), and putting that straight
 *  into the field would show a stored 70 as "70.00" and then save it back as
 *  a different-looking value. Number() normalises it; null stays empty. */
function numberField(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(parsed) : String(value);
}

/** "" rather than 0, so an untouched optional number is sent as null instead
 *  of being recorded as a real zero. */
function toNumberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Fills the form from a stored project, for the edit screen. */
export function valuesFromProject(project: Project): ProjectFormValues {
  const location = project.location ?? null;

  // A classification stored before the field existed, or one no longer in the
  // list, would otherwise select nothing and silently rewrite itself on the
  // first save. Falling back to the default makes the choice visible.
  const stored = location?.area_classification;
  const areaClassification = AREA_CLASSIFICATIONS.includes(stored as AreaClassification)
    ? (stored as AreaClassification)
    : EMPTY_PROJECT_FORM.areaClassification;

  return {
    name: project.name,
    projectType: project.project_type ?? "",
    industry: project.industry,
    landArea: numberField(project.land_area),
    investment: numberField(project.estimated_investment),
    employees: numberField(project.employees),
    operatingHours: numberField(project.operating_hours_per_day),
    description: project.description ?? "",

    latitude: numberField(location?.latitude),
    longitude: numberField(location?.longitude),
    city: location?.city ?? "",
    district: location?.district ?? "",
    state: location?.state ?? "",
    areaClassification,
    ecologicallySensitive: location?.ecologically_sensitive === true,
  };
}

/**
 * The checks worth making before a request goes out, in field order so the
 * message points at the first thing wrong. The backend validates all of this
 * too; this only saves a round trip, so it must never be the sole check.
 *
 * Returns the message to show, or null when the form is ready to send.
 */
export function validateProjectForm(values: ProjectFormValues): string | null {
  if (!values.name.trim()) return "Enter a project name.";
  if (!values.industry) return "Choose the industry or sector.";

  const lat = toNumberOrNull(values.latitude);
  const lon = toNumberOrNull(values.longitude);

  // Required because every later step depends on a point: the baseline fetch
  // queries providers by coordinate, and the noise and air comparisons are
  // selected by where the site is.
  if (lat === null || lon === null) {
    return "Enter the site latitude and longitude. The environmental baseline is fetched for that point.";
  }
  if (lat < -90 || lat > 90) return "Latitude must be between -90 and 90.";
  if (lon < -180 || lon > 180) return "Longitude must be between -180 and 180.";

  // These mirror CHECK constraints on the projects table. Without them a
  // negative figure reaches Postgres and comes back as a server error.
  const area = toNumberOrNull(values.landArea);
  if (area !== null && area < 0) return "Project area cannot be negative.";

  const investment = toNumberOrNull(values.investment);
  if (investment !== null && investment < 0) return "Estimated investment cannot be negative.";

  const employees = toNumberOrNull(values.employees);
  if (employees !== null && (employees < 0 || !Number.isInteger(employees))) {
    return "Expected employees must be a whole number and cannot be negative.";
  }

  const hours = toNumberOrNull(values.operatingHours);
  if (hours !== null && (hours < 0 || hours > 24)) {
    return "Operating hours must be between 0 and 24.";
  }

  return null;
}

/** Builds the request body. Validate first: this trusts what it is given. */
export function toProjectRequest(values: ProjectFormValues): NewProjectRequest {
  return {
    project: {
      name: values.name.trim(),
      industry: values.industry,
      projectType: values.projectType || null,
      description: values.description.trim() || null,
      landArea: toNumberOrNull(values.landArea),
      // The unit is fixed by the form's own suffix, so it is recorded only
      // when there is a figure for it to qualify.
      landAreaUnit: values.landArea.trim() ? "acres" : null,
      estimatedInvestment: toNumberOrNull(values.investment),
      employees: toNumberOrNull(values.employees),
      operatingHoursPerDay: toNumberOrNull(values.operatingHours),
    },
    location: {
      latitude: toNumberOrNull(values.latitude),
      longitude: toNumberOrNull(values.longitude),
      city: values.city.trim() || null,
      district: values.district.trim() || null,
      state: values.state.trim() || null,
      country: "India",
      areaClassification: values.areaClassification,
      ecologicallySensitive: values.ecologicallySensitive,
    },
  };
}

/** True when the site would move. The baseline is fetched per point, so the
 *  edit screen warns rather than quietly invalidating what was collected. */
export function pointMoved(before: ProjectFormValues, after: ProjectFormValues) {
  const same = (a: string, b: string) => {
    const left = toNumberOrNull(a);
    const right = toNumberOrNull(b);
    // Compared as numbers, so "17.60" and "17.6" are not treated as a move.
    if (left === null || right === null) return left === right;
    return left === right;
  };
  return !same(before.latitude, after.latitude) || !same(before.longitude, after.longitude);
}
