"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Tag-style input that turns comma-or-newline-separated text into
 * removable pills. The serialized value (one item per line) goes into
 * a hidden form field of the given `name` so server actions read it
 * exactly like a textarea.
 *
 * Usage:
 *   <ChipInput name="targetNaics" defaultValue="236220, 237310"
 *              placeholder="Add NAICS code…" />
 *
 * Accepts: typing + Enter / comma / Tab to commit a chip; Backspace
 * on empty input removes the last chip; paste from Excel splits on
 * newlines, tabs, and commas.
 */
export function ChipInput({
  name,
  defaultValue = "",
  placeholder = "Add and press Enter…",
  className = "",
}: {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
}) {
  const [chips, setChips] = useState<string[]>(() => parseSeed(defaultValue));
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (hiddenRef.current) hiddenRef.current.value = chips.join("\n");
  }, [chips]);

  function commit(raw: string) {
    const items = raw
      .split(/[,\n\t]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (items.length === 0) return;
    setChips((prev) => Array.from(new Set([...prev, ...items])));
    setDraft("");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
      if (draft.trim()) {
        e.preventDefault();
        commit(draft);
      }
    } else if (e.key === "Backspace" && draft === "" && chips.length > 0) {
      e.preventDefault();
      setChips((prev) => prev.slice(0, -1));
    }
  }

  function onPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text");
    if (/[,\n\t]/.test(text)) {
      e.preventDefault();
      commit(text);
    }
  }

  function remove(idx: number) {
    setChips((prev) => prev.filter((_, i) => i !== idx));
    inputRef.current?.focus();
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 rounded-lg border border-white/10 bg-slate-900 p-2 transition focus-within:border-cyan-500 ${className}`}
      onClick={() => inputRef.current?.focus()}
    >
      {chips.map((c, i) => (
        <span key={`${c}-${i}`} className="inline-flex items-center gap-1 rounded-full bg-cyan-500/15 px-2 py-0.5 text-xs text-cyan-100">
          {c}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); remove(i); }}
            aria-label={`Remove ${c}`}
            className="text-cyan-300 hover:text-white"
          >
            ×
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onBlur={() => draft.trim() && commit(draft)}
        placeholder={chips.length === 0 ? placeholder : ""}
        className="min-w-[8rem] flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
      />
      <input ref={hiddenRef} type="hidden" name={name} defaultValue={chips.join("\n")} />
    </div>
  );
}

function parseSeed(raw: string): string[] {
  return raw
    .split(/[,\n\t]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
