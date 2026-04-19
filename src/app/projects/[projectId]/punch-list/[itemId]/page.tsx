import { notFound } from "next/navigation";
import { DetailShell, DetailGrid, DetailField } from "@/components/layout/detail-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { formatDate } from "@/lib/utils";

export default async function PunchItemDetailPage({ params }: { params: Promise<{ projectId: string; itemId: string }> }) {
  const { projectId, itemId } = await params;
  const tenant = await requireTenant();
  const item = await prisma.punchItem.findFirst({
    where: { id: itemId, project: { id: projectId, tenantId: tenant.id } },
    include: { project: true },
  });
  if (!item) notFound();

  return (
    <DetailShell
      eyebrow={`${item.project.code} · Punch item`}
      title={item.title}
      crumbs={[{ label: "Projects", href: "/projects" }, { label: item.project.code, href: `/projects/${item.project.id}` }, { label: "Punch list", href: `/projects/${item.project.id}/punch-list` }, { label: item.title }]}
      actions={<StatusBadge status={item.status} />}
    >
      <section className="card p-6">
        <DetailGrid>
          <DetailField label="Title">{item.title}</DetailField>
          <DetailField label="Area">{item.area ?? "—"}</DetailField>
          <DetailField label="Due">{formatDate(item.dueDate)}</DetailField>
          <DetailField label="Status">{item.status.replaceAll("_", " ")}</DetailField>
          <DetailField label="Created">{formatDate(item.createdAt)}</DetailField>
        </DetailGrid>
      </section>
    </DetailShell>
  );
}
