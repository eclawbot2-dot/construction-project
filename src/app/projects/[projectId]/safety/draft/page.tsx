import { notFound } from "next/navigation";
import Link from "next/link";
import { DetailShell } from "@/components/layout/detail-shell";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { safetyIncidentNarrative } from "@/lib/execution-ai";

export default async function SafetyDraftPage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<{ injuryType?: string; location?: string; witnesses?: string; equipment?: string; summary?: string }> }) {
  const { projectId } = await params;
  const sp = await searchParams;
  const tenant = await requireTenant();
  const project = await prisma.project.findFirst({ where: { id: projectId, tenantId: tenant.id } });
  if (!project) notFound();

  const draft = sp.summary ? await safetyIncidentNarrative({
    injuryType: sp.injuryType ?? "Injury",
    location: sp.location ?? project.name,
    witnesses: sp.witnesses,
    equipment: sp.equipment,
    summary: sp.summary,
  }) : null;

  return (
    <DetailShell
      eyebrow="AI · OSHA 301 drafter"
      title="Safety incident narrative"
      subtitle="Answer the prompts; AI drafts OSHA 301 language + root-cause questions + corrective actions."
      crumbs={[{ label: "Projects", href: "/projects" }, { label: project.code, href: `/projects/${projectId}` }, { label: "Safety", href: `/projects/${projectId}/safety` }, { label: "Draft" }]}
    >
      <section className="card p-6">
        <form method="get" className="grid gap-3 md:grid-cols-2">
          <input name="injuryType" defaultValue={sp.injuryType ?? ""} placeholder="Injury type (laceration, strain, fall, etc)" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" />
          <input name="location" defaultValue={sp.location ?? ""} placeholder="Location on site" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" />
          <input name="witnesses" defaultValue={sp.witnesses ?? ""} placeholder="Witnesses (optional)" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" />
          <input name="equipment" defaultValue={sp.equipment ?? ""} placeholder="Equipment involved (optional)" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" />
          <textarea name="summary" defaultValue={sp.summary ?? ""} rows={4} placeholder="What happened? (one-paragraph narrative)" className="md:col-span-2 rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" />
          <div className="md:col-span-2 flex gap-3">
            <button type="submit" className="btn-primary">Draft report</button>
            <Link href={`/projects/${projectId}/safety`} className="btn-outline text-xs">← back</Link>
          </div>
        </form>
      </section>
      {draft ? (
        <>
          <section className="card p-6">
            <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">OSHA 301 narrative</div>
            <p className="mt-3 text-sm text-slate-200 leading-6">{draft.osha301Narrative}</p>
          </section>
          <section className="card p-6">
            <div className="text-xs uppercase tracking-[0.2em] text-amber-300">Root-cause questions</div>
            <ul className="mt-3 space-y-1 text-sm text-slate-200 list-disc pl-5">{draft.rootCauseQuestions.map((q, i) => <li key={i}>{q}</li>)}</ul>
          </section>
          <section className="card p-6">
            <div className="text-xs uppercase tracking-[0.2em] text-emerald-300">Corrective actions</div>
            <ul className="mt-3 space-y-1 text-sm text-slate-200 list-disc pl-5">{draft.correctiveActions.map((q, i) => <li key={i}>{q}</li>)}</ul>
          </section>
        </>
      ) : null}
    </DetailShell>
  );
}
