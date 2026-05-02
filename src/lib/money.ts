/**
 * Money-safety helpers for currency arithmetic on Float-stored
 * amounts.
 *
 * Currency fields in the schema use Float (IEEE-754 double). For
 * single values up to ~$1e15 with cents precision this is fine, but
 * accumulating many small amounts produces classic floating-point
 * drift (0.1 + 0.2 = 0.30000000000000004). The audit flagged this as
 * a future risk for accounting use.
 *
 * Until a Prisma Decimal migration, every report / sum / pay-app
 * total in this app should funnel through these helpers. They work
 * in integer cents internally and round to 2 decimals at the
 * boundary, matching the convention every accounting system uses.
 */

/** Round a dollar amount to 2 decimals (HALF_EVEN / banker's rounding
 *  is overkill for our scale; HALF_UP matches AIA + Sage + QB). */
export function roundCents(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/** Sum a list of dollar amounts without floating-point drift. Each
 *  value is converted to integer cents, summed, and the total is
 *  divided back at the end. */
export function sumMoney(values: ReadonlyArray<number | null | undefined>): number {
  let cents = 0;
  for (const v of values) {
    if (v == null || !Number.isFinite(v)) continue;
    cents += Math.round(v * 100);
  }
  return cents / 100;
}

/** Multiply a dollar amount by a unit-less factor (qty, rate %, etc.)
 *  with safe rounding. */
export function multiplyMoney(amount: number, factor: number): number {
  if (!Number.isFinite(amount) || !Number.isFinite(factor)) return 0;
  return roundCents(amount * factor);
}

/** Subtract one dollar amount from another with safe rounding. */
export function subtractMoney(a: number, b: number): number {
  return sumMoney([a, -b]);
}

/** Add two dollar amounts with safe rounding (alias for binary sum). */
export function addMoney(a: number, b: number): number {
  return sumMoney([a, b]);
}

/** Compute a percentage (rate × 100) of a dollar amount, rounded. */
export function percentOf(amount: number, ratePct: number): number {
  return multiplyMoney(amount, ratePct / 100);
}

/** Convert dollars to integer cents (useful for cents-only models). */
export function toCents(dollars: number | null | undefined): number {
  if (dollars == null || !Number.isFinite(dollars)) return 0;
  return Math.round(dollars * 100);
}

/** Convert integer cents back to dollars. */
export function fromCents(cents: number | null | undefined): number {
  if (cents == null || !Number.isFinite(cents)) return 0;
  return cents / 100;
}

/** Compare two dollar amounts for equality within a 1-cent tolerance.
 *  Use instead of `===` on Float-stored currency comparisons. */
export function eqMoney(a: number, b: number, toleranceCents: number = 1): boolean {
  return Math.abs(toCents(a) - toCents(b)) <= toleranceCents;
}
