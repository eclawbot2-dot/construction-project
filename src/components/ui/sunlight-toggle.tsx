"use client";

import { useEffect, useState } from "react";

/**
 * Toggle for "Sunlight mode" — AAA-contrast outdoor field viewing.
 * Persists to localStorage; applied via data-sunlight attribute on
 * the <html> element so the CSS overrides in globals.css take effect.
 *
 * The initial-state script in src/app/layout.tsx reads the same
 * localStorage key on first paint to avoid a FOUC when sunlight mode
 * is on.
 */
export function SunlightToggle() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setOn(window.localStorage.getItem("bcon-sunlight") === "true");
  }, []);

  function toggle() {
    const next = !on;
    setOn(next);
    if (typeof window !== "undefined") {
      try { window.localStorage.setItem("bcon-sunlight", String(next)); } catch { /* ignore */ }
      if (next) document.documentElement.setAttribute("data-sunlight", "true");
      else document.documentElement.removeAttribute("data-sunlight");
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={on ? "Sunlight mode ON — tap to turn off" : "Outdoor / field high-contrast mode"}
      className="rounded-lg border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] transition hover:border-cyan-500/40"
      style={{ color: on ? "#fbbf24" : "var(--faint)" }}
    >
      {on ? "☀ on" : "☀ sunlight"}
    </button>
  );
}
