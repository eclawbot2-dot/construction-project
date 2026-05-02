/**
 * FormField — server-component-friendly wrapper that pairs a label
 * with an input and standard error messaging. Keeps form markup
 * consistent across the app and gives every field a shared error
 * affordance.
 *
 * Usage:
 *   <FormField label="Email" hint="We'll never share this." error={errors.email}>
 *     <input name="email" type="email" required className="form-input" />
 *   </FormField>
 *
 * Validation strategy: server actions / route handlers redirect back
 * with ?error=Field+message which the FlashToast surfaces. For
 * inline per-field errors, the page reads the same query param into
 * a record and passes the relevant message to the matching FormField.
 */
export function FormField({
  label,
  hint,
  error,
  required,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-slate-400">
        <span>{label}</span>
        {required ? <span className="text-rose-400" aria-hidden="true">*</span> : null}
      </span>
      <div className={error ? "rounded-lg ring-1 ring-rose-500/60" : ""}>
        {children}
      </div>
      {error ? (
        <p role="alert" className="mt-1 text-xs text-rose-300">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      ) : null}
    </label>
  );
}
