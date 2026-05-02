"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Cmd+K / Ctrl+K command palette. Fuzzy-search across primary nav
 * destinations. Mirrors the Linear / Raycast pattern: open with the
 * keyboard shortcut, type, hit Enter to navigate.
 *
 * The command set is hardcoded for now — the routes shown are stable
 * across tenants. Future iteration: query the user's recent
 * projects + listings and merge them in.
 */
type Command = {
  label: string;
  href: string;
  keywords: string;
  group: "Bids" | "Projects" | "Settings" | "Admin" | "Other";
};

const COMMANDS: Command[] = [
  // Bids pipeline
  { label: "Bid Hub", href: "/bids", keywords: "bids hub overview", group: "Bids" },
  { label: "Bid portfolio", href: "/bids/portfolio", keywords: "portfolio pipeline funnel win rate", group: "Bids" },
  { label: "RFP listings", href: "/bids/listings", keywords: "rfp listings solicitations bids", group: "Bids" },
  { label: "Watched sources", href: "/bids/sources", keywords: "sources subscriptions feeds", group: "Bids" },
  { label: "Discover portals", href: "/bids/discover", keywords: "discover catalog new portals subscribe", group: "Bids" },
  { label: "Bid profile", href: "/bids/profile", keywords: "profile naics setaside bid scoring", group: "Bids" },
  { label: "Federal capture", href: "/bids/capture", keywords: "federal capture govwin", group: "Bids" },
  // Projects
  { label: "All projects", href: "/projects", keywords: "projects jobs", group: "Projects" },
  { label: "Create project", href: "/projects/create", keywords: "new project create", group: "Projects" },
  { label: "Daily logs", href: "/projects?tab=daily-logs", keywords: "daily log report field", group: "Projects" },
  // Settings
  { label: "Tenant settings", href: "/settings", keywords: "settings tenant config modes", group: "Settings" },
  { label: "AI keys", href: "/settings#ai-keys", keywords: "openai anthropic api keys ai", group: "Settings" },
  { label: "Tenant audit log", href: "/settings/audit", keywords: "audit history compliance changes", group: "Settings" },
  { label: "People directory", href: "/people", keywords: "people users team members", group: "Settings" },
  // Admin (super admin sees these regardless; non-super-admin gets 403)
  { label: "Admin home", href: "/admin", keywords: "admin platform super", group: "Admin" },
  { label: "Tenant management", href: "/admin/tenants", keywords: "admin tenants list", group: "Admin" },
  { label: "Portal coverage", href: "/admin/portal-coverage", keywords: "portals coverage scrapers admin", group: "Admin" },
  { label: "Platform audit log", href: "/admin/audit", keywords: "platform audit super admin", group: "Admin" },
  // Other
  { label: "Operations", href: "/operations", keywords: "ops operations tickets", group: "Other" },
  { label: "Finance", href: "/finance", keywords: "finance cfo cash", group: "Other" },
  { label: "AI assistant", href: "/assistant", keywords: "assistant ai chat help", group: "Other" },
  { label: "Risk", href: "/risk", keywords: "risk register", group: "Other" },
  { label: "Alerts", href: "/alerts", keywords: "alerts notifications inbox", group: "Other" },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Open on ⌘K / Ctrl+K, close on Esc.
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  // Focus the input when opening.
  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlight(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COMMANDS;
    return COMMANDS.filter((c) => {
      const hay = `${c.label} ${c.keywords} ${c.group}`.toLowerCase();
      // Loose word-prefix match — every word in the query must be a
      // prefix of some word in the haystack. Cheap fuzzy without a
      // ranking library.
      const words = q.split(/\s+/);
      return words.every((w) => hay.includes(w));
    });
  }, [query]);

  function pick(href: string) {
    setOpen(false);
    router.push(href);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-400 transition hover:border-cyan-500/40 hover:text-white"
        title="Quick search (⌘K)"
      >
        <span>Search…</span>
        <kbd className="rounded border border-white/10 bg-slate-950 px-1.5 py-0.5 text-[10px]">⌘K</kbd>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-24" onClick={() => setOpen(false)} role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-950 shadow-2xl"
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setHighlight(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => Math.min(h + 1, filtered.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
            else if (e.key === "Enter") { e.preventDefault(); const cmd = filtered[highlight]; if (cmd) pick(cmd.href); }
          }}
          placeholder="Search projects, listings, settings…"
          className="w-full rounded-t-2xl border-b border-white/10 bg-transparent px-5 py-4 text-base text-white outline-none placeholder:text-slate-500"
        />
        <ul className="max-h-[60vh] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <li className="p-3 text-sm text-slate-500">No matches. Try a shorter query.</li>
          ) : (
            filtered.map((cmd, i) => (
              <li key={cmd.href}>
                <button
                  type="button"
                  onClick={() => pick(cmd.href)}
                  onMouseEnter={() => setHighlight(i)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${i === highlight ? "bg-cyan-500/15 text-white" : "text-slate-300 hover:bg-white/5"}`}
                >
                  <span>{cmd.label}</span>
                  <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{cmd.group}</span>
                </button>
              </li>
            ))
          )}
        </ul>
        <div className="flex items-center justify-between rounded-b-2xl border-t border-white/10 px-4 py-2 text-[10px] text-slate-500">
          <span>↑↓ navigate · Enter open · Esc close</span>
          <span>⌘K to toggle</span>
        </div>
      </div>
    </div>
  );
}
