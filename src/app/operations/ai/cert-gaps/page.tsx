import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { StatTile } from "@/components/ui/stat-tile";
import { certGapDetector } from "@/lib/ops-ai";
import { requireTenant } from "@/lib/tenant";

export default async function CertGapPage() {
  const tenant = await requireTenant();
  const gaps = await certGapDetector(tenant.id);

  return (
    <AppLayout eyebrow="Ops AI" title="Certification gap detector" description="Staff assigned to roles or tasks requiring certifications they don't have on file.">
      <section className="grid gap-4 md:grid-cols-3">
        <StatTile label="Gaps detected" value={gaps.length} tone={gaps.length > 0 ? "warn" : "good"} />
      </section>
      <section className="card p-0 overflow-hidden">
        <table className="min-w-full divide-y divide-white/10 text-sm">
          <thead className="bg-white/5"><tr><th className="table-header">Employee</th><th className="table-header">Missing cert</th><th className="table-header">Required for</th></tr></thead>
          <tbody className="divide-y divide-white/10 bg-slate-950/40">
            {gaps.map((g, i) => (
              <tr key={i}>
                <td className="table-cell">{g.userName}</td>
                <td className="table-cell font-semibold text-amber-200">{g.missingCert}</td>
                <td className="table-cell text-xs text-slate-400">{g.requiredFor}</td>
              </tr>
            ))}
            {gaps.length === 0 ? <tr><td colSpan={3} className="table-cell text-center text-slate-500">No certification gaps detected.</td></tr> : null}
          </tbody>
        </table>
      </section>
      <Link href="/operations/ai" className="btn-outline text-xs">← back</Link>
    </AppLayout>
  );
}
