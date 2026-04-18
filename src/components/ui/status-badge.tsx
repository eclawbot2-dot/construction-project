import { cn, statusTone } from "@/lib/utils";

type Tone = "good" | "warn" | "bad" | "neutral" | "info";

const toneClass: Record<Tone, string> = {
  good: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
  warn: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
  bad: "bg-rose-500/15 text-rose-300 border border-rose-500/30",
  neutral: "bg-white/5 text-slate-300 border border-white/10",
  info: "bg-sky-500/15 text-sky-300 border border-sky-500/30",
};

export function StatusBadge({ status, label, tone }: { status?: string; label?: string; tone?: Tone }) {
  const t: Tone = tone ?? (status ? statusTone(status) : "neutral");
  const text = label ?? (status ? status.replaceAll("_", " ") : "—");
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]", toneClass[t])}>{text}</span>;
}
