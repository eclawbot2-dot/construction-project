/**
 * Public API token issuance + verification. Token format:
 *
 *   bcon_<14-char prefix>.<48-char secret>
 *
 * The prefix is searchable + indexed; the secret is bcrypt-hashed
 * before storage. Auth header: `Authorization: Bearer <full-token>`.
 *
 * Scopes are simple verbs: "read:projects", "write:rfis", "*".
 * Tokens with "*" can hit any public-API endpoint for the tenant.
 */

import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export type IssuedToken = {
  id: string;
  prefix: string;
  fullToken: string;     // shown ONCE on issue; never recoverable
  scopes: string[];
};

export async function issueApiToken(args: {
  tenantId: string;
  name: string;
  scopes: string[];
  createdById?: string;
  expiresAt?: Date | null;
}): Promise<IssuedToken> {
  const prefix = "bcon_" + crypto.randomBytes(7).toString("base64url").slice(0, 14);
  const secret = crypto.randomBytes(36).toString("base64url");
  const fullToken = `${prefix}.${secret}`;
  const secretHash = await bcrypt.hash(secret, 10);
  const row = await prisma.apiToken.create({
    data: {
      tenantId: args.tenantId,
      name: args.name,
      prefix,
      secretHash,
      scopesJson: JSON.stringify(args.scopes),
      createdById: args.createdById ?? null,
      expiresAt: args.expiresAt ?? null,
    },
  });
  return { id: row.id, prefix, fullToken, scopes: args.scopes };
}

export type AuthenticatedToken = {
  tokenId: string;
  tenantId: string;
  scopes: string[];
};

/**
 * Verify a token. Returns the matching ApiToken + tenantId on success.
 * On failure (no row, revoked, expired, secret mismatch) returns null
 * without leaking which step failed. Updates lastUsedAt asynchronously.
 */
export async function verifyApiToken(rawHeader: string | null): Promise<AuthenticatedToken | null> {
  if (!rawHeader) return null;
  const m = rawHeader.match(/^Bearer\s+(bcon_[A-Za-z0-9_-]{14})\.([A-Za-z0-9_-]{20,80})$/);
  if (!m) return null;
  const prefix = m[1]!;
  const secret = m[2]!;

  const row = await prisma.apiToken.findUnique({ where: { prefix } });
  if (!row) return null;
  if (row.revokedAt) return null;
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null;

  const ok = await bcrypt.compare(secret, row.secretHash);
  if (!ok) return null;

  // Best-effort lastUsedAt update; don't await.
  prisma.apiToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

  let scopes: string[] = [];
  try { scopes = JSON.parse(row.scopesJson); } catch { /* invalid scopes JSON */ }

  return { tokenId: row.id, tenantId: row.tenantId, scopes };
}

/**
 * Check whether the token's scope grants access to the given action.
 * Wildcard "*" grants everything; otherwise exact match required.
 */
export function tokenHasScope(scopes: string[], action: string): boolean {
  if (scopes.includes("*")) return true;
  return scopes.includes(action);
}
