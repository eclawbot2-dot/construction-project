import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { tenantAskAnything } from "@/lib/copilot-ai";
import { requireTenant } from "@/lib/tenant";

const EXAMPLES = [
  "What's my pipeline by mode?",
  "Which projects are over budget?",
  "Top 10 vendors by spend",
  "Show me active projects",
];

export default async function AssistantPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const tenant = await requireTenant();
  const sp = await searchParams;
  const q = sp.q ?? "";
  const result = q ? await tenantAskAnything(q, tenant.id) : null;

  return (
    <AppLayout eyebrow="AI · Copilot" title="Tenant-wide assistant" description="Ask anything about your tenant's projects, pipeline, finance. RAG-style answers with charts and tables.">
      <section className="card p-6">
        <form method="get" className="grid gap-3">
          <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Ask a question</label>
          <input name="q" defaultValue={q} placeholder="e.g. Which projects are over budget?" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" />
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <Link key={ex} href={`/assistant?q=${encodeURIComponent(ex)}`} className="rounded-full border border-white/10 bg-slate-900 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800">{ex}</Link>
            ))}
          </div>
          <button className="btn-primary w-fit">Ask</button>
        </form>
      </section>
      {result ? (
        <>
          <section className="card p-6">
            <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Answer</div>
            <p className="mt-3 text-sm text-slate-200 leading-6">{result.answer}</p>
          </section>
          {result.charts.map((c, i) => (
            <section key={i} className="card p-6">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{c.title}</div>
              <div className="mt-3 space-y-1">
                {c.labels.map((lbl, j) => {
                  const max = Math.max(...c.values, 1);
                  const pct = (c.values[j] / max) * 100;
                  return (
                    <div key={j} className="text-xs">
                      <div className="flex justify-between"><span className="text-slate-300">{lbl}</span><span className="text-slate-400 font-mono">{c.values[j].toLocaleString()}</span></div>
                      <div className="mt-1 h-2 rounded bg-white/10 overflow-hidden"><div className="h-full bg-cyan-500" style={{ width: `${pct}%` }} /></div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
          {result.tables.map((t, i) => (
            <section key={i} className="card p-0 overflow-hidden">
              <div className="px-5 py-3 text-xs uppercase tracking-[0.2em] text-slate-400">{t.title}</div>
              {t.rows.length > 0 ? (
                <table className="min-w-full divide-y divide-white/10 text-sm">
                  <thead className="bg-white/5"><tr>{Object.keys(t.rows[0]).map((k) => <th key={k} className="table-header">{k}</th>)}</tr></thead>
                  <tbody className="divide-y divide-white/10 bg-slate-950/40">
                    {t.rows.map((r, j) => <tr key={j}>{Object.values(r).map((v, k) => <td key={k} className="table-cell">{v}</td>)}</tr>)}
                  </tbody>
                </table>
              ) : <div className="p-4 text-sm text-slate-500">No rows.</div>}
            </section>
          ))}
        </>
      ) : null}
    </AppLayout>
  );
}
