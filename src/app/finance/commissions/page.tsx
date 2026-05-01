import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { StatTile } from "@/components/ui/stat-tile";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { formatDate } from "@/lib/utils";
import { Coins } from "lucide-react";

type RuleRow = Awaited<ReturnType<typeof loadRules>>[number];
type AccrualRow = Awaited<ReturnType<typeof loadAccruals>>[number];

async function loadRules(tenantId: string) {
  return prisma.commissionRule.findMany({
    where: { tenantId },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { _count: { select: { accruals: true } } },
  });
}

async function loadAccruals(tenantId: string) {
  return prisma.commissionAccrual.findMany({
    where: { tenantId },
    orderBy: [{ status: "asc" }, { earnedAt: "desc" }],
    take: 100,
    include: { rule: { select: { id: true, name: true } } },
  });
}

const STATUSES = ["ACCRUED", "PENDING_APPROVAL", "APPROVED", "PAID", "HELD", "REVERSED"] as const;

export default async function CommissionsPage() {
  const tenant = await requireTenant();

  const [rules, accruals] = await Promise.all([loadRules(tenant.id), loadAccruals(tenant.id)]);

  const totalsByStatus = await prisma.commissionAccrual.groupBy({
    by: ["status"],
    where: { tenantId: tenant.id },
    _sum: { amount: true },
  });
  const sumByStatus = (s: string) => totalsByStatus.find((t) => t.status === s)?._sum.amount ?? 0;

  const ruleColumns: DataTableColumn<RuleRow>[] = [
    { key: "name", header: "Name", render: (r) => r.name },
    { key: "appliesTo", header: "Applies to", render: (r) => r.appliesTo.replace("_", " ") },
    { key: "role", header: "Role", cellClassName: "text-xs", render: (r) => r.recipientRole ?? "—" },
    { key: "rate", header: "Rate", cellClassName: "text-xs text-right", render: (r) => `${r.ratePct}%` },
    { key: "flat", header: "Flat", cellClassName: "text-xs text-right", render: (r) => (r.flatAmount ? `$${r.flatAmount}` : "—") },
    { key: "cap", header: "Cap", cellClassName: "text-xs text-right", render: (r) => (r.cap ? `$${r.cap}` : "—") },
    { key: "active", header: "Active", render: (r) => (r.active ? <span className="text-emerald-300">yes</span> : <span className="text-slate-500">no</span>) },
    { key: "accruals", header: "Accruals", cellClassName: "text-xs text-right", render: (r) => r._count.accruals },
  ];

  const accrualColumns: DataTableColumn<AccrualRow>[] = [
    { key: "recipient", header: "Recipient", render: (a) => a.recipientName },
    { key: "source", header: "Source", cellClassName: "text-xs", render: (a) => `${a.sourceType.replace("_", " ")}${a.sourceLabel ? ` · ${a.sourceLabel}` : ""}` },
    { key: "rule", header: "Rule", cellClassName: "text-xs", render: (a) => a.rule?.name ?? "—" },
    { key: "basis", header: "Basis", cellClassName: "text-xs text-right", render: (a) => `$${a.basis.toLocaleString()}` },
    { key: "rate", header: "Rate", cellClassName: "text-xs text-right", render: (a) => `${a.ratePct}%` },
    { key: "amount", header: "Amount", cellClassName: "text-xs text-right font-semibold", render: (a) => `$${a.amount.toLocaleString()}` },
    { key: "status", header: "Status", render: (a) => a.status.replace("_", " ") },
    { key: "earned", header: "Earned", cellClassName: "text-xs text-slate-400", render: (a) => formatDate(a.earnedAt) },
    {
      key: "advance",
      header: "Move to",
      render: (a) => (
        <form action={`/api/commissions/accruals/${a.id}/status`} method="post" className="flex items-center gap-1">
          <label htmlFor={`s-${a.id}`} className="sr-only">Status</label>
          <select id={`s-${a.id}`} name="status" defaultValue={a.status} className="form-select py-1 text-xs">
            {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
          <button className="btn-outline text-xs">Save</button>
        </form>
      ),
    },
  ];

  return (
    <AppLayout
      eyebrow="Finance · Commissions"
      title="Commissions ledger"
      description="Rule-based commission accrual + payout tracking. Per req §7.1A. Manual entries supported alongside rule-driven calculations."
    >
      <div className="grid gap-6">
        <section className="grid gap-4 md:grid-cols-4">
          <StatTile label="Accrued (open)" value={`$${sumByStatus("ACCRUED").toLocaleString()}`} />
          <StatTile label="Pending approval" value={`$${sumByStatus("PENDING_APPROVAL").toLocaleString()}`} />
          <StatTile label="Approved (unpaid)" value={`$${sumByStatus("APPROVED").toLocaleString()}`} />
          <StatTile label="Paid" value={`$${sumByStatus("PAID").toLocaleString()}`} tone="good" />
        </section>

        <section className="card p-5">
          <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--heading)" }}>+ Add a commission rule</h2>
          <form action="/api/commissions/rules/create" method="post" className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto_auto_auto]">
            <input name="name" required placeholder="Rule name (e.g. Award commission)" className="form-input" />
            <select name="appliesTo" defaultValue="OPPORTUNITY" className="form-select">
              {["OPPORTUNITY", "PROJECT", "CONTRACT", "PAY_APPLICATION", "CHANGE_ORDER", "MANUAL"].map((s) => (
                <option key={s} value={s}>{s.replace("_", " ")}</option>
              ))}
            </select>
            <select name="recipientRole" defaultValue="" className="form-select">
              <option value="">— any role —</option>
              {["ADMIN", "EXECUTIVE", "MANAGER", "CAPTURE_MANAGER", "PROGRAM_MANAGER", "ACCOUNT_EXECUTIVE", "RECRUITER", "COORDINATOR"].map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <input name="ratePct" type="number" step="0.01" defaultValue={5} className="form-input w-24" placeholder="Rate %" />
            <input name="cap" type="number" step="0.01" placeholder="Cap" className="form-input w-24" />
            <button className="btn-primary">Add rule</button>
          </form>
        </section>

        <section className="card p-5">
          <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--heading)" }}>+ Record an accrual</h2>
          <form action="/api/commissions/accruals/create" method="post" className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto_1fr_auto]">
            <input name="recipientName" required placeholder="Recipient" className="form-input" />
            <select name="sourceType" defaultValue="MANUAL" className="form-select">
              {["OPPORTUNITY", "PROJECT", "CONTRACT", "PAY_APPLICATION", "CHANGE_ORDER", "MANUAL"].map((s) => (
                <option key={s} value={s}>{s.replace("_", " ")}</option>
              ))}
            </select>
            <input name="basis" type="number" step="0.01" placeholder="Basis $" className="form-input w-32" />
            <input name="ratePct" type="number" step="0.01" placeholder="Rate %" className="form-input w-24" />
            <select name="ruleId" defaultValue="" className="form-select">
              <option value="">— no rule —</option>
              {rules.filter((r) => r.active).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <button className="btn-primary">Accrue</button>
          </form>
        </section>

        <div>
          <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--heading)" }}>Accruals</h2>
          {accruals.length === 0 ? (
            <EmptyState icon={Coins} title="No accruals yet" description="Add one above to start tracking commissions." />
          ) : (
            <DataTable columns={accrualColumns} rows={accruals} rowKey={(a) => a.id} />
          )}
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--heading)" }}>Rules</h2>
          {rules.length === 0 ? (
            <EmptyState icon={Coins} title="No rules configured" description="Define a rule above to drive automatic accruals." />
          ) : (
            <DataTable columns={ruleColumns} rows={rules} rowKey={(r) => r.id} />
          )}
        </div>

        <div className="text-xs" style={{ color: "var(--faint)" }}>
          <Link href="/finance" className="underline">← back to finance</Link>
        </div>
      </div>
    </AppLayout>
  );
}
