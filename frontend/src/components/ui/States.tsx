import { AlertCircle, Inbox, Loader2, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "./Primitives";

export function Loading({ label = "Loading..." }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2.5 rounded-lg border border-line bg-surface px-6 py-12 text-sm text-ink-muted"
    >
      <Loader2 size={16} className="animate-spin text-brand" aria-hidden="true" />
      {label}
    </div>
  );
}

// Shows the backend's own message. Those messages are written for the person
// reading them ("Project not found."), so rewording them here would lose
// detail the API deliberately provided.
export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-lg border border-risk/30 bg-risk-soft/50 px-5 py-4">
      <div className="flex items-start gap-3">
        <AlertCircle size={18} className="mt-0.5 shrink-0 text-risk" aria-hidden="true" />

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-risk-ink">Could not load this</p>
          <p className="mt-1 text-sm text-risk-ink/90">{message}</p>

          {onRetry && (
            <div className="mt-3">
              <Button tone="secondary" size="sm" icon={RotateCcw} onClick={onRetry}>
                Try again
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function Empty({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface px-6 py-12 text-center">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-neutral-soft text-ink-subtle">
        <Inbox size={20} aria-hidden="true" />
      </div>

      <p className="text-sm font-semibold text-ink">{title}</p>
      {hint && <p className="mx-auto mt-1.5 max-w-md text-sm text-ink-muted">{hint}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

// A short banner for a problem inside a form, where a full ErrorState card
// would push the fields off screen.
export function InlineError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md border border-risk/30 bg-risk-soft px-3 py-2.5 text-sm text-risk-ink"
    >
      <AlertCircle size={15} className="mt-0.5 shrink-0 text-risk" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
