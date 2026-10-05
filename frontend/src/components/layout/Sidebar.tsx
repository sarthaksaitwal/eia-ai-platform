import { NavLink } from "react-router-dom";
import {
  ClipboardCheck,
  Database,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Leaf,
  Plus,
  Settings,
  X,
} from "lucide-react";
import type { ComponentType } from "react";

type Item = {
  label: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  /** Present only when the screen exists. */
  path?: string;
  /** Why it is not reachable yet, shown on hover and to assistive tech. */
  pending?: string;
};

// This list mirrors the routes in App.tsx. An item without a path is not a
// link: the previous sidebar pointed at /assessments, /reports, /help and
// /settings, none of which are routes, and the catch-all quietly bounced every
// click back to the dashboard. A control that silently does the wrong thing is
// worse than one that says it is not ready.
const NAVIGATION: { section: string; items: Item[] }[] = [
  {
    section: "Overview",
    items: [{ label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" }],
  },
  {
    section: "Projects",
    items: [
      { label: "All projects", icon: FolderKanban, path: "/projects" },
      { label: "New project", icon: Plus, path: "/projects/new" },
    ],
  },
  {
    section: "Assessment",
    items: [
      {
        label: "Assessment inputs",
        icon: ClipboardCheck,
        pending: "Opens from a project once the inputs screen is built",
      },
      {
        label: "Impact results",
        icon: Database,
        pending: "Available once the calculation engine is built",
      },
      {
        label: "Reports",
        icon: FileText,
        pending: "Available once results can be calculated",
      },
    ],
  },
];

function itemClass(active: boolean) {
  return [
    "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors duration-200",
    active
      ? "bg-brand-soft font-semibold text-brand-ink"
      : "text-ink-muted hover:bg-surface-hover hover:text-ink",
  ].join(" ");
}

export default function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <aside
      // Off-canvas below lg, pinned from lg up. aria-hidden is not used here:
      // the drawer is removed from the tab order by the transform only, so the
      // close button stays reachable while it is open.
      className={[
        "fixed left-0 top-0 z-40 flex h-screen w-60 flex-col border-r border-line bg-surface",
        "transition-transform duration-200 ease-out lg:translate-x-0",
        open ? "translate-x-0 shadow-lg" : "-translate-x-full",
      ].join(" ")}
      aria-label="Main navigation"
    >
      <div className="flex h-14 items-center justify-between gap-2 border-b border-line px-4 lg:h-16 lg:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand text-ink-inverse">
            <Leaf size={17} aria-hidden="true" />
          </span>

          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold tracking-tight text-ink">
              EIA Platform
            </span>
            <span className="block truncate text-[11px] text-ink-subtle">
              Environmental assessment
            </span>
          </span>
        </div>

        <button
          onClick={onClose}
          aria-label="Close navigation"
          className="-mr-1 flex h-9 w-9 items-center justify-center rounded-md text-ink-muted transition-colors duration-200 hover:bg-surface-hover hover:text-ink lg:hidden"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAVIGATION.map((group) => (
          <div key={group.section} className="mb-5 last:mb-0">
            <h2 className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
              {group.section}
            </h2>

            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.label}>
                  {item.path ? (
                    <NavLink
                      to={item.path}
                      // Navigating is the end of the reason the drawer was
                      // open; leaving it up means two taps to see the page.
                      onClick={onClose}
                      className={({ isActive }) => itemClass(isActive)}
                    >
                      <item.icon size={17} strokeWidth={1.8} aria-hidden="true" />
                      <span className="truncate">{item.label}</span>
                    </NavLink>
                  ) : (
                    <span
                      title={item.pending}
                      aria-disabled="true"
                      className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm text-ink-subtle"
                    >
                      <item.icon size={17} strokeWidth={1.8} aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>

                      <span className="shrink-0 rounded-sm bg-neutral-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-ink">
                        Soon
                      </span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-line p-3">
        <span
          title="No settings are stored yet"
          aria-disabled="true"
          className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm text-ink-subtle"
        >
          <Settings size={17} strokeWidth={1.8} aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">Settings</span>
          <span className="shrink-0 rounded-sm bg-neutral-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-ink">
            Soon
          </span>
        </span>

        {/* The signed-in person lives in the header menu. The old sidebar
            repeated it here with a hardcoded name and role, which was wrong
            for everyone who was not the person it was written for. */}
      </div>
    </aside>
  );
}
