/**
 * RFC 6238 TOTP (Time-based One-Time Password) — pure node:crypto, no
 * outside dependencies. Compatible with Google Authenticator, Authy,
 * 1Password, Microsoft Authenticator, Yubico Authenticator, etc.
 *
 * Defaults: SHA1, 30s window, 6-digit code (industry standard).
 * Verifier accepts ±1 step drift to handle clock skew between server
 * and authenticator.
 */

import crypto from "node:crypto";

const STEP_SECONDS = 30;
const DIGITS = 6;
const ALGORITHM = "sha1";

// RFC 4648 base32 alphabet (no padding).
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** Generate a fresh 20-byte TOTP secret as base32. */
export function generateTotpSecret(): string {
  const bytes = crypto.randomBytes(20);
  return base32Encode(bytes);
}

/** Build the otpauth:// URI an authenticator app QR-codes. */
export function totpProvisioningUri(args: { secret: string; account: string; issuer: string }): string {
  const issuer = encodeURIComponent(args.issuer);
  const account = encodeURIComponent(args.account);
  return `otpauth://totp/${issuer}:${account}?secret=${args.secret}&issuer=${issuer}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
}

/** Compute the current TOTP code for the given secret. Optional epoch
 *  override for testing. */
export function totpCurrent(secret: string, epoch: number = Date.now()): string {
  return totpAtStep(secret, Math.floor(epoch / 1000 / STEP_SECONDS));
}

/** Verify a user-supplied code against the secret. Allows ±1 step
 *  drift for clock skew tolerance (60s window total). */
export function totpVerify(secret: string, code: string, epoch: number = Date.now()): boolean {
  const cleaned = code.replace(/\D/g, "");
  if (cleaned.length !== DIGITS) return false;
  const step = Math.floor(epoch / 1000 / STEP_SECONDS);
  for (let drift = -1; drift <= 1; drift++) {
    if (timingSafeEq(totpAtStep(secret, step + drift), cleaned)) return true;
  }
  return false;
}

function totpAtStep(secretB32: string, step: number): string {
  const key = base32Decode(secretB32);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(step));
  const hmac = crypto.createHmac(ALGORITHM, key).update(buf).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const slice = hmac.subarray(offset, offset + 4);
  const bin = (slice[0]! & 0x7f) << 24 | (slice[1]! << 16) | (slice[2]! << 8) | slice[3]!;
  const code = (bin % 10 ** DIGITS).toString().padStart(DIGITS, "0");
  return code;
}

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str: string): Buffer {
  const cleaned = str.replace(/=+$/, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of cleaned) {
    const idx = B32.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function timingSafeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

/** Generate N one-time-use backup codes (8 hex chars each). Stored
 *  encrypted; consumed on use. */
export function generateBackupCodes(n: number = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < n; i++) {
    codes.push(crypto.randomBytes(4).toString("hex").toUpperCase());
  }
  return codes;
}
