"use client";

import { useState } from "react";

/**
 * Validates the tenant's saved AI key by hitting a minimal prompt.
 * Inline status: idle → pinging → ok / error. Lets a customer
 * confirm a pasted key works before relying on it for billing.
 */
export function TestAiKeyButton() {
  const [status, setStatus] = useState<"idle" | "pinging" | "ok" | "error">("idle");
  const [detail, setDetail] = useState<string>("");

  async function run() {
    setStatus("pinging");
    setDetail("");
    try {
      const res = await fetch("/api/tenant/llm-keys/test", { method: "POST" });
      const json = (await res.json()) as { ok: boolean; provider?: string; latencyMs?: number; error?: string };
      if (json.ok) {
        setStatus("ok");
        setDetail(`${json.provider ?? ""} round-trip ${json.latencyMs ?? "?"}ms`);
      } else {
        setStatus("error");
        setDetail(json.error ?? "unknown error");
      }
    } catch (err) {
      setStatus("error");
      setDetail(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={run}
        disabled={status === "pinging"}
        className="btn-outline text-xs"
        title="Sends a 5-token prompt with your saved key to verify it's accepted."
      >
        {status === "pinging" ? "testing..." : "Test key"}
      </button>
      {status === "ok" ? <span className="text-xs text-emerald-300">✓ {detail}</span> : null}
      {status === "error" ? <span className="text-xs text-rose-300" title={detail}>✗ {detail.slice(0, 80)}</span> : null}
    </div>
  );
}
