import Link from "next/link";

type Tone = "good" | "warn" | "bad" | "default";

export function StatTile({ label, value, sub, tone = "default", href }: { label: string; value: string | number; sub?: string; tone?: Tone; href?: string }) {
  const toneClass = tone === "good" ? "text-emerald-300" : tone === "warn" ? "text-amber-300" : tone === "bad" ? "text-rose-300" : "text-white";
  const inner = (
    <div className={`panel p-4 ${href ? "transition hover:border-cyan-500/40 hover:shadow-lg cursor-pointer" : ""}`}>
      <div className="text-xs uppercase tracking-[0.16em] text-slate-400">{label}</div>
      <div className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</div>
      {sub ? <div className="mt-1 text-xs text-slate-500">{sub}</div> : null}
      {href ? <div className="mt-1 text-[10px] uppercase tracking-[0.22em] text-cyan-300">View →</div> : null}
    </div>
  );
  return href ? <Link href={href} className="block">{inner}</Link> : inner;
}
