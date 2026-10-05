import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, LogOut, Search } from "lucide-react";

import { useAuth } from "../../lib/auth";
import { ROLES } from "../../lib/types";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Header() {
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
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const roleLabel = ROLES.find((r) => r.value === user?.role)?.label ?? user?.role ?? "";

  return (
    <header className="fixed left-60 right-0 top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-7">
      {/* Search is not wired to anything yet: the backend has no search
          endpoint, and the projects table filters on the page itself. */}
      <div className="relative w-80">
        <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />

        <input
          type="text"
          placeholder="Search is on the projects page"
          disabled
          className="h-9 w-full cursor-not-allowed rounded-md border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-400 outline-none"
        />
      </div>

      <div className="flex items-center gap-5">
        <div className="h-6 w-px bg-slate-200" />

        <div ref={menuRef} className="relative">
          <button
            onClick={() => setOpen((value) => !value)}
            className="flex items-center gap-2"
            aria-haspopup="menu"
            aria-expanded={open}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-800">
              {user ? initials(user.name) : "?"}
            </div>

            <div className="text-left">
              <div className="text-sm font-medium text-slate-800">{user?.name ?? "Signed out"}</div>
            </div>

            <ChevronDown size={15} className="text-slate-400" />
          </button>

          {open && (
            <div
              role="menu"
              className="absolute right-0 top-11 w-60 border border-slate-200 bg-white py-1 shadow-sm"
            >
              <div className="border-b border-slate-100 px-4 py-3">
                <p className="truncate text-sm font-medium text-slate-800">{user?.name}</p>
                <p className="mt-0.5 truncate text-xs text-slate-500">{user?.email}</p>
                <p className="mt-1 text-xs text-slate-400">{roleLabel}</p>
                {user?.organization && (
                  <p className="mt-0.5 truncate text-xs text-slate-400">{user.organization}</p>
                )}
              </div>

              <button
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  signOut();
                  navigate("/signin", { replace: true });
                }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                <LogOut size={15} className="text-slate-400" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
