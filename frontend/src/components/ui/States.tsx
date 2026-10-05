import { AlertCircle, Inbox, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

export function Loading({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2.5 border border-slate-200 bg-white px-6 py-14 text-sm text-slate-500">
      <Loader2 size={16} className="animate-spin text-emerald-700" />
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
    <div className="border border-red-200 bg-red-50/60 px-6 py-5">
      <div className="flex items-start gap-3">
        <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-600" />

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-red-900">Could not load this</p>
          <p className="mt-1 text-sm text-red-800">{message}</p>

          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-800 transition hover:bg-red-100"
            >
              Try again
            </button>
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
    <div className="border border-slate-200 bg-white px-6 py-14 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Inbox size={19} />
      </div>

      <p className="text-sm font-medium text-slate-800">{title}</p>
      {hint && <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// A short banner for a problem inside a form, where a full ErrorState card
// would push the fields off screen.
export function InlineError({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
      <AlertCircle size={15} className="mt-0.5 shrink-0 text-red-600" />
      <span>{message}</span>
    </div>
  );
}
