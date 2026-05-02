import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { formatCurrency, formatDate } from "@/lib/utils";
import { sumMoney } from "@/lib/money";

const IMPORT_KINDS = [
  { value: "PROJECT_ACTUALS", label: "Project actuals (historical costs)" },
  { value: "BID_HISTORY", label: "Bid history (past RFP results)" },
  { value: "INCOME_STATEMENT", label: "Income statement (monthly P&L)" },
  { value: "BUDGET_TEMPLATE", label: "Budget template" },
  { value: "SCHEDULE_OF_VALUES", label: "Schedule of values" },
  { value: "VENDOR_LIST", label: "Vendor list" },
];

export default async function ImportsPage() {
  const tenant = await requireTenant();
  const [imports, projects] = await Promise.all([
    prisma.historicalImport.findMany({ where: { tenantId: tenant.id }, include: { project: true }, orderBy: { createdAt: "desc" } }),
    prisma.project.findMany({ where: { tenantId: tenant.id }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }),
  ]);

  const totalRows = imports.reduce((s, i) => s + i.rowsDetected, 0);
  const imported = imports.reduce((s, i) => s + i.rowsImported, 0);
  const totalDollars = sumMoney(imports.map((i) => i.totalDollarValue));

  return (
    <AppLayout eyebrow="Historical data" title="Spreadsheet imports" description="Upload CSV/XLSX of past project costs, bid history, or income statements. AI reviews each row, flags gaps, and pushes clean data into bcon.">
      <div className="grid gap-6">
        <section className="grid gap-4 md:grid-cols-4">
          <StatTile label="Imports on file" value={imports.length} />
          <StatTile label="Rows parsed" value={totalRows.toLocaleString()} />
          <StatTile label="Rows imported" value={imported.toLocaleString()} tone="good" />
          <StatTile label="Historical dollar value" value={formatCurrency(totalDollars)} />
        </section>
        <section className="card p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Upload spreadsheet</div>
          <p className="mt-1 text-sm text-slate-400">CSV is supported natively. Export XLSX to CSV first (Excel → File → Save As → CSV UTF-8), then upload. AI will match columns and flag anomalies before anything is imported.</p>
          <form action="/api/imports/upload" method="post" encType="multipart/form-data" className="mt-4 grid gap-3 md:grid-cols-[2fr_1fr_1fr_2fr_auto]">
            <input name="label" placeholder="Label (e.g. FY24 project costs)" required className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500" />
            <select name="kind" defaultValue="PROJECT_ACTUALS" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500">
              {IMPORT_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
            <select name="projectId" defaultValue="" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500">
              <option value="">— tenant-wide —</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}
            </select>
            <input name="file" type="file" accept=".csv,text/csv" required className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-cyan-500/20 file:px-3 file:py-1 file:text-sm file:text-cyan-100" />
            <button className="btn-primary">Upload + AI review</button>
          </form>
        </section>

        <section className="card p-0 overflow-hidden">
          <div className="px-5 py-3 text-xs uppercase tracking-[0.2em] text-slate-400">Recent imports</div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-sm">
              <thead className="bg-white/5">
                <tr>
                  <th className="table-header">Label</th>
                  <th className="table-header">Kind</th>
                  <th className="table-header">Project</th>
                  <th className="table-header">File</th>
                  <th className="table-header">Rows</th>
                  <th className="table-header">Imported</th>
                  <th className="table-header">Dollar value</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Uploaded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-950/40">
                {imports.map((i) => (
                  <tr key={i.id} className="transition hover:bg-white/5">
                    <td className="table-cell"><Link href={`/imports/${i.id}`} className="text-cyan-300 hover:underline">{i.label}</Link></td>
                    <td className="table-cell text-xs uppercase tracking-[0.18em] text-slate-400">{i.kind.replaceAll("_", " ")}</td>
                    <td className="table-cell">{i.project ? <Link href={`/projects/${i.project.id}`} className="text-cyan-300 hover:underline">{i.project.code}</Link> : <span className="text-slate-500">tenant-wide</span>}</td>
                    <td className="table-cell font-mono text-xs text-slate-400">{i.filename}</td>
                    <td className="table-cell">{i.rowsDetected.toLocaleString()}</td>
                    <td className="table-cell">{i.rowsImported.toLocaleString()}</td>
                    <td className="table-cell">{formatCurrency(i.totalDollarValue)}</td>
                    <td className="table-cell"><StatusBadge status={i.status} /></td>
                    <td className="table-cell text-slate-400">{formatDate(i.createdAt)}</td>
                  </tr>
                ))}
                {imports.length === 0 ? <tr><td colSpan={9} className="table-cell text-center text-slate-500">No historical imports yet. Upload your first CSV above.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
