import { notFound } from "next/navigation";
import Link from "next/link";
import { DetailShell } from "@/components/layout/detail-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { reviewSubmittalAgainstSpec } from "@/lib/execution-ai";

export default async function SubmittalReviewPage({ params }: { params: Promise<{ projectId: string; submittalId: string }> }) {
  const { projectId, submittalId } = await params;
  const tenant = await requireTenant();
  const s = await prisma.submittal.findFirst({ where: { id: submittalId, project: { id: projectId, tenantId: tenant.id } }, include: { project: true } });
  if (!s) notFound();
  const result = await reviewSubmittalAgainstSpec(submittalId, tenant.id);

  return (
    <DetailShell
      eyebrow="AI · Submittal compliance"
      title={s.title}
      subtitle={`Spec ${s.specSection ?? "—"} · ${result.recommendation}`}
      crumbs={[{ label: "Projects", href: "/projects" }, { label: s.project.code, href: `/projects/${projectId}` }, { label: "Submittals", href: `/projects/${projectId}/submittals` }, { label: s.number, href: `/projects/${projectId}/submittals/${submittalId}` }, { label: "Review" }]}
      actions={<StatusBadge status={result.overall} />}
    >
      <section className="card p-0 overflow-hidden">
        <table className="min-w-full divide-y divide-white/10 text-sm">
          <thead className="bg-white/5">
            <tr>
              <th className="table-header">Requirement</th>
              <th className="table-header">Status</th>
              <th className="table-header">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10 bg-slate-950/40">
            {result.findings.map((f, i) => (
              <tr key={i}>
                <td className="table-cell">{f.requirement}</td>
                <td className="table-cell"><StatusBadge status={f.status} /></td>
                <td className="table-cell text-xs text-slate-400">{f.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <Link href={`/projects/${projectId}/submittals/${submittalId}`} className="btn-outline text-xs">← back</Link>
    </DetailShell>
  );
}
