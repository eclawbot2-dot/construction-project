import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";

export default async function OwnerPortalPage() {
  const tenant = await requireTenant();
  const projects = await prisma.project.findMany({ where: { tenantId: tenant.id }, orderBy: { updatedAt: "desc" } });

  return (
    <AppLayout eyebrow="Owner portal" title="Client-facing project portal" description="Clients can chat with AI about their project's schedule, cost, change orders, contract.">
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => (
          <Link key={p.id} href={`/portal/${p.id}`} className="card p-6 transition hover:border-cyan-500/50">
            <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">{p.code}</div>
            <div className="text-lg font-semibold text-white mt-1">{p.name}</div>
            <div className="mt-3 text-xs text-slate-500">Tap to open AI assistant</div>
          </Link>
        ))}
      </section>
    </AppLayout>
  );
}
