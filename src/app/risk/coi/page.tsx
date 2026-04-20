import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { StatTile } from "@/components/ui/stat-tile";
import { coiExpirationScan } from "@/lib/compliance-ai";
import { requireTenant } from "@/lib/tenant";
import { formatDate } from "@/lib/utils";

export default async function CoiScanPage() {
  const tenant = await requireTenant();
  const flags = await coiExpirationScan(tenant.id);
  const critical = flags.filter((f) => f.daysUntilExpiry <= 14).length;
  const warning = flags.filter((f) => f.daysUntilExpiry > 14 && f.daysUntilExpiry <= 30).length;

  return (
    <AppLayout eyebrow="AI · Risk" title="Certificate of Insurance scan" description="Nightly review of vendor insurance; expirations ≤ 60 days flagged.">
      <section className="grid gap-4 md:grid-cols-4">
        <StatTile label="Lapsing ≤ 60d" value={flags.length} />
        <StatTile label="Critical (≤ 14d)" value={critical} tone="bad" />
        <StatTile label="Warning (15-30d)" value={warning} tone="warn" />
        <StatTile label="Soon (31-60d)" value={flags.length - critical - warning} />
      </section>
      {flags.map((f) => (
        <section key={f.vendorId + f.policyType} className="card p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-amber-300">{f.policyType}</div>
              <div className="text-lg font-semibold text-white mt-1"><Link href={`/vendors/${f.vendorId}`} className="hover:text-cyan-200">{f.vendorName}</Link></div>
              <div className="text-xs text-slate-400 mt-1">Expires {formatDate(f.expiresAt)} · {f.daysUntilExpiry} days remaining</div>
            </div>
          </div>
          <div className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">Renewal email draft</div>
          <pre className="mt-2 whitespace-pre-wrap text-sm text-slate-200 font-sans leading-6">{f.emailDraft}</pre>
        </section>
      ))}
      {flags.length === 0 ? <div className="card p-8 text-center text-slate-500">No insurance certs lapsing in the next 60 days.</div> : null}
      <Link href="/risk" className="btn-outline text-xs">← back to risk hub</Link>
    </AppLayout>
  );
}
