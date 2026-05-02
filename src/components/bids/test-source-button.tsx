"use client";

import { useState } from "react";

/**
 * Probes a single subscribed source's scraper without writing
 * listings. Inline status + sample title + error detail. Useful for
 * operators who want to confirm a source actually works before
 * trusting the sweep.
 */
export function TestSourceButton({ sourceId }: { sourceId: string }) {
  const [status, setStatus] = useState<"idle" | "running" | "ok" | "error" | "manual">("idle");
  const [detail, setDetail] = useState<string>("");

  async function run() {
    setStatus("running");
    setDetail("");
    try {
      const res = await fetch(`/api/rfp/sources/${sourceId}/test`, { method: "POST" });
      const json = (await res.json()) as { ok: boolean; count: number; firstTitle?: string | null; note: string; isManual?: boolean };
      if (json.ok) {
        setStatus("ok");
        setDetail(json.firstTitle ? `${json.count} listings · "${json.firstTitle}"` : `${json.count} listings`);
      } else if (json.isManual) {
        setStatus("manual");
        setDetail(json.note);
      } else {
        setStatus("error");
        setDetail(json.note);
      }
    } catch (err) {
      setStatus("error");
      setDetail(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={run}
        disabled={status === "running"}
        className="btn-outline text-xs"
        title="Runs the scraper read-only — no listings are written."
      >
        {status === "running" ? "testing..." : "Test"}
      </button>
      {status === "ok" ? <span className="text-[10px] text-emerald-300" title={detail}>✓ {detail.slice(0, 60)}</span> : null}
      {status === "manual" ? <span className="text-[10px] text-amber-300" title={detail}>manual only</span> : null}
      {status === "error" ? <span className="text-[10px] text-rose-300" title={detail}>✗ {detail.slice(0, 50)}</span> : null}
    </div>
  );
}
