import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";

import Sidebar from "./Sidebar";
import Header from "./Header";

export default function AppLayout() {
  const [navOpen, setNavOpen] = useState(false);

  // Escape closes it, which is what every other overlay on the web does.
  useEffect(() => {
    if (!navOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setNavOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [navOpen]);

  return (
    <div className="min-h-screen bg-canvas">
      {/* Keyboard and screen-reader users should not have to walk the whole
          navigation on every page to reach the page itself. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink-inverse"
      >
        Skip to content
      </a>

      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />

      {/* Below lg the sidebar is an overlay, so it needs a backdrop that both
          dims the page and gives a large target to dismiss it with. */}
      {navOpen && (
        <div
          onClick={() => setNavOpen(false)}
          className="fixed inset-0 z-30 bg-ink/40 lg:hidden"
          aria-hidden="true"
        />
      )}

      <Header onOpenNav={() => setNavOpen(true)} />

      <main id="main" className="pt-14 lg:ml-60 lg:pt-16">
        <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
