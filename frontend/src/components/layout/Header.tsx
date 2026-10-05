import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, LogOut, Menu } from "lucide-react";

import { useAuth } from "../../lib/auth";
import { ROLES } from "../../lib/types";
import { initialsOf } from "../../lib/format";

export default function Header({ onOpenNav }: { onOpenNav: () => void }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on an outside click, so the menu does not stay open while the
  // person works elsewhere on the page.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const roleLabel = ROLES.find((r) => r.value === user?.role)?.label ?? user?.role ?? "";

  return (
    <header className="fixed left-0 right-0 top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-line bg-surface px-4 lg:left-60 lg:h-16 lg:px-7">
      <button
        onClick={onOpenNav}
        aria-label="Open navigation"
        className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors duration-200 hover:bg-surface-hover hover:text-ink lg:hidden"
      >
        <Menu size={19} aria-hidden="true" />
      </button>

      {/* The old header held a search box that was disabled, because there is
          no search endpoint and the projects table filters itself. A control
          that can never be used is noise in a dense UI, so it is gone and the
          row carries the signed-in context instead. */}
      <p className="min-w-0 flex-1 truncate text-sm text-ink-subtle lg:flex-none">
        {user?.organization || roleLabel || " "}
      </p>

      <div ref={menuRef} className="relative shrink-0">
        <button
          onClick={() => setOpen((value) => !value)}
          className="flex items-center gap-2 rounded-md py-1 pl-1 pr-1.5 transition-colors duration-200 hover:bg-surface-hover"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-ink">
            {user ? initialsOf(user.name) : "?"}
          </span>

          <span className="hidden max-w-40 truncate text-sm font-semibold text-ink sm:block">
            {user?.name ?? "Signed out"}
          </span>

          <ChevronDown size={15} className="text-ink-subtle" aria-hidden="true" />
        </button>

        {open && (
          <div
            role="menu"
            className="absolute right-0 top-11 w-64 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-lg"
          >
            <div className="border-b border-line px-4 py-3">
              <p className="truncate text-sm font-semibold text-ink">{user?.name}</p>
              <p className="mt-0.5 truncate text-xs text-ink-muted">{user?.email}</p>
              <p className="mt-1.5 truncate text-xs text-ink-subtle">{roleLabel}</p>
              {user?.organization && (
                <p className="truncate text-xs text-ink-subtle">{user.organization}</p>
              )}
            </div>

            <button
              role="menuitem"
              onClick={() => {
                setOpen(false);
                signOut();
                navigate("/signin", { replace: true });
              }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-ink-muted transition-colors duration-200 hover:bg-surface-hover hover:text-ink"
            >
              <LogOut size={15} aria-hidden="true" />
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
