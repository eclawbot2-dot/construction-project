import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { formatDate } from "@/lib/utils";
import { ClipboardList } from "lucide-react";

const STEP_STATUSES = ["PENDING", "IN_PROGRESS", "WAIVED", "COMPLETE", "BLOCKED"] as const;

export default async function OnboardingPage() {
  const tenant = await requireTenant();

  const [paths, candidates, placements, totalActive, totalCompleted] = await Promise.all([
    prisma.onboardingPath.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 50,
      include: {
        steps: { orderBy: { ordering: "asc" } },
        candidate: { select: { id: true, firstName: true, lastName: true } },
        placement: { select: { id: true, projectId: true } },
      },
    }),
    prisma.candidate.findMany({
      where: { tenantId: tenant.id, status: { in: ["OFFER", "HIRED"] } },
      select: { id: true, firstName: true, lastName: true },
      orderBy: { lastName: "asc" },
      take: 100,
    }),
    prisma.placement.findMany({
      where: { tenantId: tenant.id, status: { in: ["PENDING_START", "ACTIVE"] } },
      select: { id: true, candidate: { select: { firstName: true, lastName: true } } },
      orderBy: { startDate: "desc" },
      take: 100,
    }),
    prisma.onboardingPath.count({
      where: { tenantId: tenant.id, status: { in: ["PLANNED", "IN_PROGRESS", "ON_HOLD"] } },
    }),
    prisma.onboardingPath.count({ where: { tenantId: tenant.id, status: "COMPLETED" } }),
  ]);

  return (
    <AppLayout
      eyebrow="People · Onboarding"
      title="Onboarding pipeline"
      description="Stage-based onboarding with document collection, training, access provisioning, and manager signoff. Per req §7.1A."
    >
      <div className="grid gap-6">
        <section className="grid gap-4 md:grid-cols-3">
          <StatTile label="Active paths" value={totalActive} />
          <StatTile label="Completed" value={totalCompleted} tone="good" />
          <StatTile label="Showing" value={paths.length} />
        </section>

        <section className="card p-5">
          <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--heading)" }}>+ Start an onboarding path</h2>
          <form action="/api/onboarding/paths/create" method="post" className="grid gap-3 md:grid-cols-[2fr_2fr_2fr_1fr_auto_auto]">
            <input name="personName" required placeholder="Name" className="form-input" />
            <select name="candidateId" defaultValue="" className="form-select">
              <option value="">— optional candidate —</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
              ))}
            </select>
            <select name="placementId" defaultValue="" className="form-select">
              <option value="">— optional placement —</option>
              {placements.map((p) => (
                <option key={p.id} value={p.id}>{p.candidate.firstName} {p.candidate.lastName}</option>
              ))}
            </select>
            <input name="role" placeholder="Role" className="form-input" />
            <label className="flex items-center gap-2 text-xs" style={{ color: "var(--faint)" }}>
              <input type="checkbox" name="seedDefaults" defaultChecked /> Seed default steps
            </label>
            <button className="btn-primary">Start</button>
          </form>
          <p className="mt-2 text-xs" style={{ color: "var(--faint)" }}>
            Default seed includes I-9/W-4, direct deposit, safety orientation, access + equipment, background check, and a manager signoff. Edit individual steps after creation.
          </p>
        </section>

        {paths.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No onboarding paths yet"
            description="Start one above. Each path tracks document collection, training, access provisioning, and signoff for one new hire."
          />
        ) : (
          <div className="grid gap-4">
            {paths.map((path) => {
              const required = path.steps.filter((s) => s.required);
              const completedCount = required.filter((s) => s.status === "COMPLETE" || s.status === "WAIVED").length;
              const pct = required.length > 0 ? Math.round((completedCount / required.length) * 100) : 0;
              return (
                <article key={path.id} className="card p-5">
                  <header className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <h3 className="text-base font-semibold" style={{ color: "var(--heading)" }}>{path.personName}</h3>
                      <div className="text-xs" style={{ color: "var(--faint)" }}>
                        {path.role ?? "—"} · {path.status.replace("_", " ")} ·
                        {path.startDateTarget ? ` start ${formatDate(path.startDateTarget)}` : " no start date"}
                        {path.candidate ? ` · candidate: ${path.candidate.firstName} ${path.candidate.lastName}` : ""}
                      </div>
                    </div>
                    <div className="text-xs" style={{ color: "var(--faint)" }}>
                      <span className="font-mono">{completedCount} / {required.length}</span> required complete · <span className="font-semibold">{pct}%</span>
                    </div>
                  </header>
                  <ol className="mt-4 grid gap-2">
                    {path.steps.map((step) => (
                      <li key={step.id} className="panel flex items-center gap-2 p-2">
                        <span className="w-6 text-right text-xs font-mono" style={{ color: "var(--faint)" }}>{step.ordering}.</span>
                        <span className="text-xs uppercase tracking-wider" style={{ color: "var(--faint)" }}>{step.kind.replace(/_/g, " ")}</span>
                        <span className="flex-1 text-sm" style={{ color: "var(--heading)" }}>
                          {step.label}
                          {!step.required ? <span className="ml-2 text-xs" style={{ color: "var(--faint)" }}>(optional)</span> : null}
                          {step.blocker ? <span className="ml-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-200">{step.blocker}</span> : null}
                        </span>
                        <form action={`/api/onboarding/steps/${step.id}/status`} method="post" className="flex items-center gap-1">
                          <label htmlFor={`step-${step.id}`} className="sr-only">Status</label>
                          <select id={`step-${step.id}`} name="status" defaultValue={step.status} className="form-select py-1 text-xs">
                            {STEP_STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                          </select>
                          <button className="btn-outline text-xs">Save</button>
                        </form>
                      </li>
                    ))}
                  </ol>
                </article>
              );
            })}
          </div>
        )}

        <div className="text-xs" style={{ color: "var(--faint)" }}>
          <Link href="/people/ats" className="underline">← back to ATS</Link>
        </div>
      </div>
    </AppLayout>
  );
}
