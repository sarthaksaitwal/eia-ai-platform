import type { ComponentType, ReactNode } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";

/* ---------------------------------------------------------------------------
   Shared building blocks.

   These exist so the tokens in index.css are applied once rather than retyped
   on every page, which is what let the old UI drift into three different
   shades of grey for the same kind of label.
--------------------------------------------------------------------------- */

type ButtonTone = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

const TONE: Record<ButtonTone, string> = {
  primary: "bg-brand text-ink-inverse hover:bg-brand-hover active:bg-brand-active",
  secondary:
    "border border-line-strong bg-surface text-ink hover:bg-surface-hover active:bg-line",
  ghost: "text-ink-muted hover:bg-surface-hover hover:text-ink",
  danger: "bg-risk text-ink-inverse hover:bg-risk-ink",
};

const SIZE: Record<ButtonSize, string> = {
  // 36px and 40px. Both clear the 44px target once the 8px gap between
  // adjacent controls is counted, and a pointer-first dashboard would lose
  // too much vertical room at a literal 44px row height.
  sm: "h-9 gap-1.5 px-3 text-sm",
  md: "h-10 gap-2 px-4 text-sm",
};

function buttonClass(tone: ButtonTone, size: ButtonSize, full?: boolean) {
  return [
    "inline-flex shrink-0 items-center justify-center rounded-md font-semibold",
    "transition-colors duration-200",
    "disabled:pointer-events-none disabled:opacity-55",
    TONE[tone],
    SIZE[size],
    full ? "w-full" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function Button({
  children,
  tone = "primary",
  size = "md",
  icon: Icon,
  busy,
  full,
  type = "button",
  ...rest
}: {
  children: ReactNode;
  tone?: ButtonTone;
  size?: ButtonSize;
  icon?: ComponentType<{ size?: number; className?: string }>;
  busy?: boolean;
  full?: boolean;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className">) {
  return (
    <button type={type} className={buttonClass(tone, size, full)} {...rest}>
      {busy ? (
        <Loader2 size={15} className="animate-spin" aria-hidden="true" />
      ) : (
        Icon && <Icon size={16} aria-hidden="true" />
      )}
      {children}
    </button>
  );
}

export function ButtonLink({
  children,
  to,
  tone = "primary",
  size = "md",
  icon: Icon,
  full,
}: {
  children: ReactNode;
  to: string;
  tone?: ButtonTone;
  size?: ButtonSize;
  icon?: ComponentType<{ size?: number; className?: string }>;
  full?: boolean;
}) {
  return (
    <Link to={to} className={buttonClass(tone, size, full)}>
      {Icon && <Icon size={16} aria-hidden="true" />}
      {children}
    </Link>
  );
}

/* --------------------------------- Surface -------------------------------- */

export function Card({
  children,
  className = "",
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
}) {
  return (
    <Tag
      className={`overflow-hidden rounded-lg border border-line bg-surface ${className}`}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-ink-subtle">{hint}</p>}
      </div>

      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  hint,
  action,
}: {
  eyebrow?: string;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand">
            {eyebrow}
          </p>
        )}

        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h1>

        {hint && <p className="mt-1 text-sm text-ink-muted">{hint}</p>}
      </div>

      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* --------------------------------- Status --------------------------------- */

export type Tone = "ok" | "warn" | "risk" | "neutral" | "brand";

const BADGE: Record<Tone, string> = {
  ok: "bg-ok-soft text-ok-ink",
  warn: "bg-warn-soft text-warn-ink",
  risk: "bg-risk-soft text-risk-ink",
  neutral: "bg-neutral-soft text-neutral-ink",
  brand: "bg-brand-soft text-brand-ink",
};

/**
 * A status badge always carries an icon and a word. Colour on its own is not
 * readable to someone who cannot distinguish the hues, and in this product the
 * difference between green and red is the difference between a site that
 * complies and one that does not.
 */
export function Badge({
  children,
  tone = "neutral",
  icon: Icon,
}: {
  children: ReactNode;
  tone?: Tone;
  icon?: ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <span
      className={`inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${BADGE[tone]}`}
    >
      {Icon && <Icon size={12} aria-hidden="true" />}
      {children}
    </span>
  );
}

/* ---------------------------------- Data ---------------------------------- */

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  to,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  to?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
          {label}
        </span>

        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand-ink">
          <Icon size={16} aria-hidden="true" />
        </span>
      </div>

      <div className="tabular mt-3 text-2xl font-semibold tracking-tight text-ink">{value}</div>

      {hint && <p className="mt-1 text-xs text-ink-subtle">{hint}</p>}
    </>
  );

  const shell =
    "block rounded-lg border border-line bg-surface px-4 py-4 transition-colors duration-200";

  return to ? (
    <Link to={to} className={`${shell} hover:border-brand hover:bg-surface-sunken`}>
      {body}
    </Link>
  ) : (
    <div className={shell}>{body}</div>
  );
}

/**
 * A definition row. Used wherever a stored field is shown read-only, which on
 * this product is most of a project and site.
 */
export function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">{label}</dt>
      <dd className="mt-1 break-words text-sm text-ink">{children}</dd>
    </div>
  );
}

/** Stands in for a value the platform does not have, without looking broken. */
export function NoValue({ children = "Not recorded" }: { children?: ReactNode }) {
  return <span className="text-ink-subtle">{children}</span>;
}

/* --------------------------------- Callout -------------------------------- */

export function Note({
  title,
  children,
  tone = "neutral",
  icon: Icon,
}: {
  title?: string;
  children: ReactNode;
  tone?: Tone;
  icon?: ComponentType<{ size?: number; className?: string }>;
}) {
  const skin: Record<Tone, string> = {
    ok: "border-ok/30 bg-ok-soft/50 text-ok-ink",
    warn: "border-warn/30 bg-warn-soft/50 text-warn-ink",
    risk: "border-risk/30 bg-risk-soft/50 text-risk-ink",
    neutral: "border-line bg-surface text-ink-muted",
    brand: "border-brand/25 bg-brand-soft/50 text-brand-ink",
  };

  return (
    <div className={`flex items-start gap-3 rounded-lg border px-4 py-3.5 ${skin[tone]}`}>
      {Icon && <Icon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />}

      <div className="min-w-0 text-sm">
        {title && <p className="font-semibold">{title}</p>}
        <div className={title ? "mt-1" : ""}>{children}</div>
      </div>
    </div>
  );
}

/* ---------------------------------- Form ---------------------------------- */

export function Field({
  label,
  htmlFor,
  required,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
        {required && (
          <span className="ml-1 text-risk" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {children}

      {/* Helper text sits under the field it belongs to, not in a block at the
          top of the form where it is read too late to be of use. */}
      {hint && <p className="mt-1.5 text-xs text-ink-subtle">{hint}</p>}
    </div>
  );
}
