import { notFound } from "next/navigation";
import Link from "next/link";
import { DetailShell } from "@/components/layout/detail-shell";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { draftRfi } from "@/lib/execution-ai";

export default async function DraftRfiPage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<{ observation?: string; trade?: string }> }) {
  const { projectId } = await params;
  const sp = await searchParams;
  const tenant = await requireTenant();
  const project = await prisma.project.findFirst({ where: { id: projectId, tenantId: tenant.id } });
  if (!project) notFound();

  const observation = sp.observation ?? "";
  const draft = observation ? await draftRfi({ observation, project: project.name, trade: sp.trade }) : null;

  return (
    <DetailShell
      eyebrow="AI · Draft RFI"
      title={`Draft an RFI from a field observation`}
      subtitle={`Type what you saw. AI formalizes subject + question + impact.`}
      crumbs={[{ label: "Projects", href: "/projects" }, { label: project.code, href: `/projects/${projectId}` }, { label: "RFIs", href: `/projects/${projectId}/rfis` }, { label: "Draft" }]}
    >
      <section className="card p-6">
        <form method="get" className="grid gap-3">
          <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Observation</label>
          <textarea name="observation" defaultValue={observation} rows={5} placeholder="e.g. Concrete on south facade is spalling. Spec says exposure class C. Question: owner approval for accelerated cure?" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" />
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
            <input name="trade" defaultValue={sp.trade ?? ""} placeholder="Trade (optional)" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" />
            <button type="submit" className="btn-primary">Draft RFI</button>
            <Link href={`/projects/${projectId}/rfis`} className="btn-outline text-xs">← back</Link>
          </div>
        </form>
      </section>
      {draft ? (
        <section className="card p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Subject</div>
          <div className="text-lg font-semibold text-white mt-1">{draft.subject}</div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400 mt-4">Question / formal RFI</div>
          <pre className="mt-2 whitespace-pre-wrap text-sm text-slate-200 font-sans leading-6">{draft.question}</pre>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400 mt-4">Impact narrative</div>
          <p className="mt-2 text-sm text-slate-200 leading-6">{draft.impactNarrative}</p>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400 mt-4">Suggested ball-in-court</div>
          <div className="mt-2 font-mono text-sm text-emerald-200">{draft.suggestedBallInCourt}</div>
        </section>
      ) : null}
    </DetailShell>
  );
}
