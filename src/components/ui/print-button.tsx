"use client";

export function PrintButton({ label = "Print / PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => { if (typeof window !== "undefined") window.print(); }}
      className="btn-outline text-xs"
    >
      {label}
    </button>
  );
}
