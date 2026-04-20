import Link from "next/link";
import { notFound } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { StatTile } from "@/components/ui/stat-tile";
import { answerOwnerQuestion } from "@/lib/client-ai";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { formatCurrency } from "@/lib/utils";

export default async function OwnerProjectPortal({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<{ q?: string }> }) {
  const { projectId } = await params;
  const sp = await searchParams;
  const tenant = await requireTenant();
  const project = await prisma.project.findFirst({ where: { id: projectId, tenantId: tenant.id } });
  if (!project) notFound();

  const answer = sp.q ? await answerOwnerQuestion({ question: sp.q, projectId, tenantId: tenant.id }) : null;

  return (
    <AppLayout eyebrow={`Owner portal · ${project.code}`} title={project.name} description="Ask anything about your project. AI answers only from your project's data.">
      <section className="grid gap-4 md:grid-cols-3">
        <StatTile label="Contract value" value={formatCurrency(project.contractValue ?? 0)} />
        <StatTile label="Stage" value={project.stage.replaceAll("_", " ")} />
        <StatTile label="Project mode" value={project.mode} />
      </section>
      <section className="card p-6">
        <form method="get" className="grid gap-3">
          <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Ask a question</label>
          <input name="q" defaultValue={sp.q ?? ""} placeholder="How much have we spent to date? When will my project finish?" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" />
          <div className="flex gap-3">
            <button className="btn-primary">Ask</button>
            <Link href="/portal" className="btn-outline text-xs">← back</Link>
          </div>
        </form>
      </section>
      {answer ? (
        <section className="card p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">AI answer</div>
          <p className="mt-3 text-sm text-slate-200 leading-6">{answer.answer}</p>
          {answer.sources.length > 0 ? <div className="mt-3 text-xs text-slate-500">Sources: {answer.sources.join(", ")}</div> : null}
        </section>
      ) : null}
    </AppLayout>
  );
}
