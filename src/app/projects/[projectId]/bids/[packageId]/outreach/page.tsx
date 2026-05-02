import { notFound } from "next/navigation";
import Link from "next/link";
import { DetailShell } from "@/components/layout/detail-shell";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { draftSubOutreach } from "@/lib/sales-ai";
import { toNum } from "@/lib/money";

export default async function SubOutreachPage({ params }: { params: Promise<{ projectId: string; packageId: string }> }) {
  const { projectId, packageId } = await params;
  const tenant = await requireTenant();
  const pkg = await prisma.bidPackage.findFirst({
    where: { id: packageId, project: { id: projectId, tenantId: tenant.id } },
    include: { project: true },
  });
  if (!pkg) notFound();

  const email = await draftSubOutreach({
    trade: pkg.trade,
    scope: pkg.scopeSummary ?? `Full ${pkg.trade} scope per drawings and specs for ${pkg.project.name}.`,
    estimatedValue: toNum(pkg.estimatedValue),
    dueDate: pkg.dueDate ?? undefined,
    projectName: pkg.project.name,
  });

  return (
    <DetailShell
      eyebrow="AI · Sub outreach"
      title={email.subject}
      subtitle={`Invitation to bid for ${pkg.trade} on ${pkg.project.name}`}
      crumbs={[{ label: "Projects", href: "/projects" }, { label: pkg.project.code, href: `/projects/${pkg.project.id}` }, { label: "Bids", href: `/projects/${pkg.project.id}/bids` }, { label: pkg.name, href: `/projects/${pkg.project.id}/bids/${pkg.id}` }, { label: "Outreach" }]}
    >
      <section className="card p-6">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Subject</div>
        <div className="mt-2 text-lg font-semibold text-white">{email.subject}</div>
      </section>
      <section className="card p-6">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Body</div>
        <pre className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-200 font-sans">{email.body}</pre>
      </section>
      <div className="flex gap-2">
        <Link href={`/projects/${projectId}/bids/${packageId}`} className="btn-outline text-xs">← back to package</Link>
      </div>
    </DetailShell>
  );
}
