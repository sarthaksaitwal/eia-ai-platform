import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  CircleSlash,
  ClipboardList,
  Droplets,
  Factory,
  Leaf,
  MapPin,
  Minus,
  Recycle,
  ShieldAlert,
  Trash2,
  Volume2,
} from "lucide-react";
import type { ComponentType } from "react";

import { Badge, ButtonLink } from "../components/ui/Primitives";
import type { Tone } from "../components/ui/Primitives";

/* ---------------------------------------------------------------------------
   The one page a signed-out visitor can reach.

   It says what the platform computes and, just as importantly, what it
   declines to compute. Someone arriving from a report or a viva needs to know
   before signing in that a figure here is arithmetic over published factors
   rather than a model's guess, so the status vocabulary gets a section of its
   own instead of a line in a feature list.

   Everything below is static. No API call runs here, because the backend
   wants a bearer token for every route except /health and the auth pair.
--------------------------------------------------------------------------- */

interface Entry {
  icon: ComponentType<{ size?: number; className?: string }>;
  title: string;
  detail: string;
}

// The five rows in the modules table, in the order the sidebar lists them.
// A module added by seeding will not turn up here on its own: this is prose
// for a visitor, not the registry the input form is built from.
const MODULES: Entry[] = [
  {
    icon: Factory,
    title: "Carbon",
    detail:
      "Grid and fuel CO2 from CEA and IPCC 2006 factors. Biogenic CO2 keeps its "
      + "own line and stays out of the total, the way the Guidelines ask.",
  },
  {
    icon: Droplets,
    title: "Water",
    detail:
      "Fresh water drawn, wastewater generated, and the share recycled back "
      + "into the process.",
  },
  {
    icon: Volume2,
    title: "Noise",
    detail:
      "Day and night levels at the boundary, held against the CPCB ambient "
      + "limit for the zone the site sits in.",
  },
  {
    icon: Trash2,
    title: "Waste",
    detail:
      "Hazardous and non-hazardous streams, by quantity and by route of "
      + "disposal.",
  },
  {
    icon: Recycle,
    title: "Resource efficiency",
    detail:
      "Energy and material drawn per tonne of product, so two plants of "
      + "different sizes can still be compared.",
  },
];

const STEPS: Entry[] = [
  {
    icon: MapPin,
    title: "Locate the site",
    detail:
      "Drop a pin and the platform gathers the surrounding baseline from public "
      + "providers: air quality, land cover, protected areas, population.",
  },
  {
    icon: ClipboardList,
    title: "Enter what you know",
    detail:
      "Answer the questions the plant can answer and mark the rest unavailable. "
      + "A blank stays a blank, and a half-filled form survives a refresh.",
  },
  {
    icon: Calculator,
    title: "Read the workings",
    detail:
      "Every output carries its formula, the constants that went into it, and "
      + "the document each constant was taken from.",
  },
];

// The chips a result can carry. These are the real Badge components rather
// than pictures of them, so this section cannot drift away from what the
// results page actually renders.
const STATUSES: {
  tone: Tone;
  icon: ComponentType<{ size?: number; className?: string }>;
  label: string;
  detail: string;
}[] = [
  {
    tone: "ok",
    icon: CheckCircle2,
    label: "Within limit",
    detail: "Held against a published threshold, and under it.",
  },
  {
    tone: "risk",
    icon: AlertTriangle,
    label: "Outside limit",
    detail: "Held against a published threshold, and over it.",
  },
  {
    tone: "neutral",
    icon: Minus,
    label: "Not compared",
    detail:
      "Calculated, but no regulation sets a limit for it. India caps noise at "
      + "the boundary; it sets no ceiling on a plant's annual CO2. Silence "
      + "would read as a pass, so the gap is named instead.",
  },
  {
    tone: "warn",
    icon: ShieldAlert,
    label: "Provisional",
    detail:
      "A constant behind the figure has not been checked against its source "
      + "yet, such as a superseded CEA grid factor or an IPCC default standing "
      + "in for an India-specific one. It carries forward: anything derived "
      + "from a provisional figure is provisional too.",
  },
  {
    tone: "neutral",
    icon: CircleSlash,
    label: "Not calculated",
    detail:
      "An input is missing, a unit does not match, or no factor covers this "
      + "case. Nothing is substituted, least of all a zero.",
  },
];

const SOURCES = [
  "CPCB ambient noise and effluent standards",
  "2006 IPCC Guidelines for National Greenhouse Gas Inventories",
  "CEA CO2 Baseline Database for the Indian Power Sector",
];

function SectionHeading({ title, lead }: { title: string; lead: string }) {
  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
        {title}
      </h2>
      <p className="mt-2 text-sm text-ink-muted">{lead}</p>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-canvas">
      {/* The signed-out header. The app shell's sidebar would be misleading
          here, since nothing it links to can load without a token. */}
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4">
          <span className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand text-ink-inverse">
              <Leaf size={18} aria-hidden="true" />
            </span>
            <span className="text-base font-semibold tracking-tight text-ink">
              EIA Platform
            </span>
          </span>

          <ButtonLink to="/signin" tone="secondary" size="sm">
            Sign in
          </ButtonLink>
        </div>
      </header>

      <main>
        {/* ------------------------------- Hero ------------------------------ */}
        <section className="border-b border-line bg-surface">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:py-20">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-ink">
              <MapPin size={12} aria-hidden="true" />
              Solapur district, Maharashtra
            </span>

            <h1 className="mt-5 max-w-3xl text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
              Environmental impact, calculated from published factors.
            </h1>

            <p className="mt-4 max-w-2xl text-base text-ink-muted">
              An assessment platform for industrial sites. It works out carbon,
              water, noise, waste and resource figures from the numbers a plant
              can actually supply, and shows the source behind every one of
              them. The language model explains a result. It never invents one.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <ButtonLink to="/signup">Create an account</ButtonLink>
              <ButtonLink to="/signin" tone="secondary">
                Sign in
              </ButtonLink>
            </div>

            <p className="mt-6 text-xs text-ink-subtle">
              Five modules &middot; 42 questions &middot; 18 calculated outputs
            </p>
          </div>
        </section>

        {/* ----------------------------- Modules ----------------------------- */}
        <section className="mx-auto max-w-5xl px-4 py-14">
          <SectionHeading
            title="What it assesses"
            lead="Each module asks only for what it needs, and reports each output on its own terms."
          />

          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map(({ icon: Icon, title, detail }) => (
              <li key={title} className="rounded-lg border border-line bg-surface p-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-soft text-brand-ink">
                  <Icon size={17} aria-hidden="true" />
                </span>
                <h3 className="mt-3 text-sm font-semibold text-ink">{title}</h3>
                <p className="mt-1.5 text-sm text-ink-muted">{detail}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ------------------------------ Steps ------------------------------ */}
        <section className="border-y border-line bg-surface">
          <div className="mx-auto max-w-5xl px-4 py-14">
            <SectionHeading
              title="How an assessment runs"
              lead="Three passes, and you can stop between any of them."
            />

            <ol className="mt-8 grid gap-6 sm:grid-cols-3">
              {STEPS.map(({ icon: Icon, title, detail }, index) => (
                <li key={title}>
                  <div className="flex items-center gap-2.5">
                    <span className="tabular flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line-strong text-xs font-semibold text-ink-muted">
                      {index + 1}
                    </span>
                    <Icon size={16} className="text-brand" aria-hidden="true" />
                  </div>

                  <h3 className="mt-3 text-sm font-semibold text-ink">{title}</h3>
                  <p className="mt-1.5 text-sm text-ink-muted">{detail}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ----------------------------- Statuses ---------------------------- */}
        <section className="mx-auto max-w-5xl px-4 py-14">
          <SectionHeading
            title="Every figure says how far to trust it"
            lead="A number on its own is not an assessment. These are the chips a result can carry, and they are the same ones the results page shows."
          />

          <ul className="mt-8 overflow-hidden rounded-lg border border-line bg-surface">
            {STATUSES.map(({ tone, icon, label, detail }) => (
              <li
                key={label}
                className="flex flex-col gap-2 border-b border-line px-5 py-4 last:border-b-0 sm:flex-row sm:items-start sm:gap-5"
              >
                <span className="sm:w-40 sm:shrink-0">
                  <Badge tone={tone} icon={icon}>
                    {label}
                  </Badge>
                </span>
                <p className="text-sm text-ink-muted">{detail}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ----------------------------- Sources ----------------------------- */}
        <section className="border-t border-line bg-surface">
          <div className="mx-auto max-w-5xl px-4 py-14">
            <SectionHeading
              title="Where the factors come from"
              lead="Each constant is stored with its citation, its version, and whether anyone has verified it yet."
            />

            <ul className="mt-6 space-y-2">
              {SOURCES.map((source) => (
                <li key={source} className="flex items-start gap-2 text-sm text-ink-muted">
                  <CheckCircle2
                    size={14}
                    className="mt-0.5 shrink-0 text-ok"
                    aria-hidden="true"
                  />
                  {source}
                </li>
              ))}
            </ul>

            <div className="mt-8">
              <ButtonLink to="/signup">Start an assessment</ButtonLink>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <p className="text-xs text-ink-subtle">
            A final-year B.Tech project. Figures here are produced for study and
            are not a substitute for a statutory environmental impact
            assessment.
          </p>
        </div>
      </footer>
    </div>
  );
}
