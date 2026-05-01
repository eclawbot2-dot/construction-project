/**
 * Form input parsing helpers.
 *
 * Pass-9 audit caught a recurring footgun across the new edit routes:
 * `Number(form.get(field) ?? "")` silently coerces whitespace, garbage,
 * or empty strings into NaN or 0 and writes that back to the database.
 * Worse, `<select>`-driven enum fields silently retained the previous
 * value when the submitted value was invalid, so a user submitting a
 * malformed value saw a 303 redirect and no indication their change
 * didn't apply.
 *
 * These helpers force an explicit decision at the call site: keep the
 * old value, default to a known fallback, or reject the request.
 */

/**
 * Parse a numeric form field. Returns the parsed value if it looks like
 * a number; returns `fallback` for empty / whitespace / NaN.
 *
 * Optional `min` / `max` clamp the result. Pass them as strict bounds —
 * a value outside the range is *clamped*, not rejected, because edit
 * forms are forgiving by design.
 */
export function parseNumberField(
  value: FormDataEntryValue | null,
  fallback: number | null,
  opts?: { min?: number; max?: number },
): number | null {
  if (value == null) return fallback;
  const trimmed = String(value).trim();
  if (trimmed === "") return fallback;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return fallback;
  let out = n;
  if (opts?.min != null && out < opts.min) out = opts.min;
  if (opts?.max != null && out > opts.max) out = opts.max;
  return out;
}

/**
 * Parse a string form field. Trims; returns `fallback` (often the
 * existing value or null) if the trimmed value is empty.
 */
export function parseStringField(value: FormDataEntryValue | null, fallback: string | null): string | null {
  if (value == null) return fallback;
  const trimmed = String(value).trim();
  return trimmed === "" ? fallback : trimmed;
}

/**
 * Parse a date field expressed as `yyyy-mm-dd`. Anchors to UTC midnight
 * to avoid the "<input type=date> sends a local date but `new Date()`
 * interprets the resulting ISO string in the *runtime's* zone, so a
 * UTC-8 user picking 2026-05-15 ends up with 2026-05-14T16:00:00Z
 * stored" footgun.
 *
 * Returns `null` for empty input. Returns `fallback` if the string is
 * malformed.
 */
export function parseDateField(value: FormDataEntryValue | null, fallback: Date | null): Date | null {
  if (value == null) return fallback;
  const trimmed = String(value).trim();
  if (trimmed === "") return null;
  // Browser <input type="date"> sends "yyyy-mm-dd". Append time + Z to
  // anchor at UTC midnight so the stored Date matches the picker value
  // regardless of the server's timezone.
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? `${trimmed}T00:00:00Z` : trimmed;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

/**
 * Parse an enum field against a finite list of allowed values. Returns
 * `null` (caller should reject as 400) if the submitted value is not a
 * member. Empty submissions return `fallback` rather than null so
 * "didn't change this field" submits cleanly.
 */
export function parseEnumField<T extends string>(
  value: FormDataEntryValue | null,
  allowed: readonly T[],
  fallback: T,
): T | null {
  if (value == null) return fallback;
  const trimmed = String(value).trim();
  if (trimmed === "") return fallback;
  return (allowed as readonly string[]).includes(trimmed) ? (trimmed as T) : null;
}
