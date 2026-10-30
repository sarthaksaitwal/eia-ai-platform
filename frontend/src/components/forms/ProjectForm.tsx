import {
  ArrowLeft,
  Building2,
  Clock3,
  IndianRupee,
  MapPin,
  Ruler,
  Users,
} from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { InlineError } from "../ui/States";
import { Button, Card, Field } from "../ui/Primitives";
import { inputClass, selectClass, textareaClass } from "../ui/fieldStyles";
import {
  INDUSTRIES,
  PROJECT_TYPES,
  type ProjectFormValues,
} from "../../lib/projectForm";
import { AREA_CLASSIFICATIONS, type AreaClassification } from "../../lib/types";

/* ---------------------------------------------------------------------------
   The project and site form, shared by the create and edit screens.

   One component rather than two copies: these fields map onto table columns
   and CHECK constraints, so a field that drifted between the two screens
   would mean a project could be created with a value it could not be edited
   to, or the reverse. The caller supplies the header, the submit label and
   what happens on submit; everything inside the card is the same either way.
--------------------------------------------------------------------------- */

/** A number field with an icon on the left and its unit on the right. */
function NumberField({
  id,
  label,
  value,
  onChange,
  icon: Icon,
  suffix,
  placeholder,
  min = "0",
  max,
  step = "any",
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  icon: typeof Ruler;
  suffix?: string;
  placeholder?: string;
  min?: string;
  max?: string;
  step?: string;
  disabled?: boolean;
}) {
  return (
    <Field label={label} htmlFor={id}>
      <div className="relative">
        <Icon
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"
          aria-hidden="true"
        />

        <input
          id={id}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          // The unit label sits in the padding on the right, so the room for
          // it is reserved rather than overlapped by a long figure.
          className={`${inputClass} pl-9 ${suffix ? "pr-16" : ""}`}
        />

        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-subtle">
            {suffix}
          </span>
        )}
      </div>
    </Field>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  hint,
}: {
  icon: typeof Building2;
  title: string;
  hint: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand-ink">
        <Icon size={18} aria-hidden="true" />
      </div>

      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>
      </div>
    </div>
  );
}

export default function ProjectForm({
  values,
  onChange,
  onSubmit,
  submitLabel,
  submitIcon,
  busy,
  error,
  cancelTo,
  locationHint,
  notice,
}: {
  values: ProjectFormValues;
  /** Patches one or more fields. The caller owns the state so the edit screen
   *  can compare it against what was loaded. */
  onChange: (patch: Partial<ProjectFormValues>) => void;
  onSubmit: () => void;
  submitLabel: string;
  submitIcon?: typeof ArrowLeft;
  busy?: boolean;
  error?: string | null;
  cancelTo: string;
  /** What the site section says under its heading, which differs between
   *  creating a project and moving an existing one. */
  locationHint: string;
  /** Shown above the footer. The edit screen uses it to warn that moving the
   *  point leaves the collected baseline behind. */
  notice?: ReactNode;
}) {
  // Geolocation's busy flag and its error belong here, not to the caller: the
  // caller owns the project's values, and a failed lookup changes none of
  // them. Kept in one object so a retry clears both together.
  const [locating, setLocating] = useState<{ busy: boolean; error: string | null }>({
    busy: false,
    error: null,
  });

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setLocating({ busy: false, error: "This browser does not provide a location." });
      return;
    }

    setLocating({ busy: true, error: null });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChange({
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        });
        setLocating({ busy: false, error: null });
      },
      (positionError) => {
        setLocating({
          busy: false,
          error: `Could not read your location: ${positionError.message}`,
        });
      },
      { timeout: 10_000 }
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="max-w-5xl"
      // Browser validation is off: the messages it shows cannot be worded for
      // this form, and every rule here is checked by validateProjectForm and
      // again by the backend.
      noValidate
    >
      <Card>
        <div className="border-b border-line px-6 py-5">
          <SectionHeader
            icon={Building2}
            title="Basic project information"
            hint="General information about the proposed project."
          />
        </div>

        <div className="grid grid-cols-1 gap-x-6 gap-y-5 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Project name" htmlFor="name" required>
              <input
                id="name"
                value={values.name}
                onChange={(event) => onChange({ name: event.target.value })}
                placeholder="Enter project name"
                disabled={busy}
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Project type" htmlFor="projectType">
            <select
              id="projectType"
              value={values.projectType}
              onChange={(event) => onChange({ projectType: event.target.value })}
              disabled={busy}
              className={selectClass}
            >
              <option value="">Select project type</option>
              {PROJECT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Industry / Sector"
            htmlFor="industry"
            required
            hint="Coefficients and sector limits are keyed by industry."
          >
            <select
              id="industry"
              value={values.industry}
              onChange={(event) => onChange({ industry: event.target.value })}
              disabled={busy}
              className={selectClass}
            >
              <option value="">Select industry</option>
              {INDUSTRIES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>

          <NumberField
            id="landArea"
            label="Project area"
            value={values.landArea}
            onChange={(landArea) => onChange({ landArea })}
            icon={Ruler}
            suffix="acres"
            placeholder="25"
            disabled={busy}
          />

          <NumberField
            id="investment"
            label="Estimated investment"
            value={values.investment}
            onChange={(investment) => onChange({ investment })}
            icon={IndianRupee}
            suffix="Crore"
            placeholder="120"
            disabled={busy}
          />

          <NumberField
            id="employees"
            label="Expected employees"
            value={values.employees}
            onChange={(employees) => onChange({ employees })}
            icon={Users}
            step="1"
            placeholder="350"
            disabled={busy}
          />

          <NumberField
            id="operatingHours"
            label="Operating hours"
            value={values.operatingHours}
            onChange={(operatingHours) => onChange({ operatingHours })}
            icon={Clock3}
            suffix="hours/day"
            placeholder="16"
            max="24"
            disabled={busy}
          />

          <div className="sm:col-span-2">
            <Field label="Project description" htmlFor="description">
              <textarea
                id="description"
                rows={4}
                value={values.description}
                onChange={(event) => onChange({ description: event.target.value })}
                placeholder="Briefly describe the proposed project..."
                disabled={busy}
                className={`${textareaClass} resize-none`}
              />
            </Field>
          </div>
        </div>

        <div className="border-y border-line px-6 py-5">
          <SectionHeader icon={MapPin} title="Site location" hint={locationHint} />
        </div>

        <div className="grid grid-cols-1 gap-x-6 gap-y-5 p-5 sm:grid-cols-2">
          <Field label="Latitude" htmlFor="latitude" required>
            <input
              id="latitude"
              type="number"
              step="any"
              value={values.latitude}
              onChange={(event) => onChange({ latitude: event.target.value })}
              placeholder="17.6599"
              disabled={busy}
              className={inputClass}
            />
          </Field>

          <Field label="Longitude" htmlFor="longitude" required>
            <input
              id="longitude"
              type="number"
              step="any"
              value={values.longitude}
              onChange={(event) => onChange({ longitude: event.target.value })}
              placeholder="75.9064"
              disabled={busy}
              className={inputClass}
            />
          </Field>

          <div className="sm:col-span-2">
            <Button
              onClick={useCurrentLocation}
              tone="secondary"
              busy={locating.busy}
              icon={MapPin}
              disabled={busy || locating.busy}
            >
              Use current location
            </Button>

            {locating.error && (
              <p className="mt-2 text-xs text-risk-ink">{locating.error}</p>
            )}
          </div>

          <Field label="City / Town" htmlFor="city">
            <input
              id="city"
              value={values.city}
              onChange={(event) => onChange({ city: event.target.value })}
              placeholder="Solapur"
              disabled={busy}
              className={inputClass}
            />
          </Field>

          <Field
            label="District"
            htmlFor="district"
            hint="The published baseline is collected for Solapur district."
          >
            <input
              id="district"
              value={values.district}
              onChange={(event) => onChange({ district: event.target.value })}
              disabled={busy}
              className={inputClass}
            />
          </Field>

          <Field label="State" htmlFor="state">
            <input
              id="state"
              value={values.state}
              onChange={(event) => onChange({ state: event.target.value })}
              disabled={busy}
              className={inputClass}
            />
          </Field>

          <Field
            label="Area classification"
            htmlFor="areaClassification"
            required
            hint="Ambient noise limits depend on this, so it is declared rather than guessed."
          >
            <select
              id="areaClassification"
              value={values.areaClassification}
              onChange={(event) =>
                onChange({ areaClassification: event.target.value as AreaClassification })
              }
              disabled={busy}
              className={selectClass}
            >
              {AREA_CLASSIFICATIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>

          <div className="sm:col-span-2">
            <label className="flex items-start gap-2.5">
              <input
                type="checkbox"
                checked={values.ecologicallySensitive}
                onChange={(event) =>
                  onChange({ ecologicallySensitive: event.target.checked })
                }
                disabled={busy}
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

        {(notice || error) && (
          <div className="space-y-3 px-6 pb-5">
            {notice}
            {error && <InlineError message={error} />}
          </div>
        )}

        <div className="flex items-center justify-between gap-4 border-t border-line bg-surface-sunken px-6 py-4">
          <Link
            to={cancelTo}
            className="flex items-center gap-2 text-sm font-semibold text-ink-muted transition-colors duration-200 hover:text-ink"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Cancel
          </Link>

          <Button type="submit" busy={busy} disabled={busy} icon={submitIcon}>
            {busy ? "Saving..." : submitLabel}
          </Button>
        </div>
      </Card>
    </form>
  );
}
