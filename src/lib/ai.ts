/**
 * Shared AI wrapper.
 *
 * All AI functions across the app route through `aiCall()`. The wrapper
 * is provider-agnostic — set EITHER environment variable plus
 * `ENABLE_LLM_CALLS=true` to enable real LLM calls:
 *
 *   OPENAI_API_KEY      → OpenAI Chat Completions API.
 *                         OPENAI_MODEL overrides default (gpt-4o-mini).
 *   ANTHROPIC_API_KEY   → Anthropic Messages API.
 *                         ANTHROPIC_MODEL overrides default (claude-sonnet-4-6).
 *
 * If both are set, OpenAI wins. If neither is set, every aiCall() returns
 * the caller-supplied deterministic mock. This keeps dev / CI / no-key
 * deploys from making outbound HTTP calls.
 *
 * `aiCallCached` additionally persists outputs to the `AiRunLog` table
 * so repeat views of the same AI-generated result are instant and do
 * not recompute. Feedback helpers record accept/reject signals.
 */

import { prisma } from "@/lib/prisma";

type AiCallParams<T> = {
  kind: string;
  prompt: string;
  system?: string;
  maxTokens?: number;
  fallback: () => T | Promise<T>;
  parse?: (raw: string) => T;
};

type Provider = "openai" | "anthropic" | "none";

export function llmProvider(): Provider {
  if (process.env.ENABLE_LLM_CALLS !== "true") return "none";
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return "none";
}

export function isLlmEnabled(): boolean {
  return llmProvider() !== "none";
}

async function callOpenAi(p: { prompt: string; system?: string; maxTokens?: number }): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      max_tokens: p.maxTokens ?? 2048,
      messages: [
        ...(p.system ? [{ role: "system" as const, content: p.system }] : []),
        { role: "user" as const, content: p.prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`openai ${res.status}`);
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content ?? "";
}

async function callAnthropic(p: { prompt: string; system?: string; maxTokens?: number }): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY as string,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
      max_tokens: p.maxTokens ?? 2048,
      system: p.system,
      messages: [{ role: "user", content: p.prompt }],
    }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}`);
  const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  return (json.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
}

export async function aiCall<T>(p: AiCallParams<T>): Promise<T> {
  if (!p.parse) return await p.fallback();
  const provider = llmProvider();
  if (provider === "none") return await p.fallback();
  try {
    const text = provider === "openai"
      ? await callOpenAi({ prompt: p.prompt, system: p.system, maxTokens: p.maxTokens })
      : await callAnthropic({ prompt: p.prompt, system: p.system, maxTokens: p.maxTokens });
    return p.parse(text);
  } catch (err) {
    console.error(`[ai] ${provider} call failed for kind=${p.kind}; falling back to mock`, err);
    return await p.fallback();
  }
}

/** Variant that caches the result in `AiRunLog` keyed by (tenantId, kind, inputHash). */
export async function aiCallCached<T>(params: AiCallParams<T> & {
  tenantId: string;
  entityType?: string;
  entityId?: string;
  cacheKey: string;
  ttlMinutes?: number;
}): Promise<{ result: T; runId: string; cached: boolean }> {
  const inputHash = stableHash(params.cacheKey).toString(36);
  const ttl = params.ttlMinutes ?? 60;
  const cutoff = new Date(Date.now() - ttl * 60_000);
  const existing = await prisma.aiRunLog.findFirst({
    where: { tenantId: params.tenantId, kind: params.kind, inputHash, createdAt: { gte: cutoff } },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    try { return { result: JSON.parse(existing.outputJson) as T, runId: existing.id, cached: true }; } catch { /* fall through to recompute */ }
  }
  const result = await aiCall(params);
  const log = await prisma.aiRunLog.create({
    data: {
      tenantId: params.tenantId,
      kind: params.kind,
      inputHash,
      entityType: params.entityType,
      entityId: params.entityId,
      outputJson: JSON.stringify(result),
      source: isLlmEnabled() && params.parse ? `llm:${llmProvider()}` : "heuristic",
    },
  });
  return { result, runId: log.id, cached: false };
}

export async function recordAiFeedback(runId: string, feedback: "ACCEPTED" | "REJECTED" | "EDITED", note?: string): Promise<void> {
  await prisma.aiRunLog.update({
    where: { id: runId },
    data: { userFeedback: feedback, feedbackNote: note ?? null },
  });
}

/** Deterministic "hash" so mock outputs look varied-but-stable per input. */
export function stableHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function pickStable<T>(items: readonly T[], key: string): T {
  return items[stableHash(key) % items.length];
}

export function rangeStable(key: string, min: number, max: number): number {
  const span = max - min;
  return min + (stableHash(key) % (span + 1));
}
