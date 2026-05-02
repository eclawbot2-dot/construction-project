/**
 * Runtime validation for the ~26 JSON-string columns in the Prisma
 * schema. Each column has a Zod schema here that callers use to
 * parse-or-default the JSON safely. The architecture audit caught
 * that bare JSON.parse() on these columns was a silent-corruption
 * vector — schema drift or a hand-edited row could crash the dashboard
 * with no useful error.
 *
 * Pattern: every JSON column gets a `parseX(raw: string)` helper that
 * returns `{ok: true, value} | {ok: false, fallback}`. Callers either
 * use the value directly or render an "ignore corrupted record"
 * affordance.
 */

import { z } from "zod";
import { log } from "@/lib/log";

const stringList = z.array(z.string());
const stringRecord = z.record(z.string(), z.unknown());

/** Generic safe-parse helper — returns the parsed value or a fallback. */
export function safeParseJson<T>(raw: string | null | undefined, schema: z.ZodSchema<T>, fallback: T, ctx?: { column?: string; entityId?: string }): T {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    const result = schema.safeParse(parsed);
    if (result.success) return result.data;
    log.warn("json schema validation failed", { module: "json-schema", column: ctx?.column, entityId: ctx?.entityId, errors: result.error.issues.slice(0, 3) });
    return fallback;
  } catch (err) {
    log.warn("json parse failed", { module: "json-schema", column: ctx?.column, entityId: ctx?.entityId }, err);
    return fallback;
  }
}

// ─── Catalog of typed JSON columns ─────────────────────────────────

/** Tenant.enabledModes — list of ProjectMode strings */
export const enabledModesSchema = z.array(z.enum(["SIMPLE", "VERTICAL", "HEAVY_CIVIL"]));
export const featurePacksSchema = stringList;
export const terminologyOverrideSchema = stringRecord;

/** RfpSource.keywordsJson — list of search keywords */
export const keywordsListSchema = stringList;

/** TenantBidProfile.* JSON columns — all simple string lists */
export const targetNaicsSchema = stringList;
export const qualifiedSetAsidesSchema = stringList;
export const targetStatesSchema = stringList;
export const targetCitiesSchema = stringList;
export const boostKeywordsSchema = stringList;
export const blockKeywordsSchema = stringList;
export const preferredTiersSchema = stringList;

/** RfpListing.scoreExplanation — array of scoring signals */
export const scoreSignalSchema = z.object({
  name: z.string(),
  weight: z.number(),
  fit: z.number(),
  note: z.string().optional(),
});
export const scoreExplanationSchema = z.array(scoreSignalSchema);

/** Membership.permissionsJson — flexible permission map */
export const permissionsSchema = stringRecord;

/** Project.tabsJson — list of enabled tabs */
export const tabsSchema = stringList;

/** WorkflowRun.payloadJson — opaque per-template payload */
export const workflowPayloadSchema = stringRecord;

/** AuditEvent before/after — opaque snapshots */
export const auditSnapshotSchema = z.union([z.null(), stringRecord, z.array(z.unknown()), z.string(), z.number(), z.boolean()]);

/** AiRunLog.outputJson — opaque AI output */
export const aiOutputSchema = z.unknown();

// ─── Convenience helpers used across the app ───────────────────────

export function parseStringList(raw: string | null | undefined, column?: string): string[] {
  return safeParseJson(raw, stringList, [], { column });
}

export function parseStringRecord(raw: string | null | undefined, column?: string): Record<string, unknown> {
  return safeParseJson(raw, stringRecord, {}, { column });
}
