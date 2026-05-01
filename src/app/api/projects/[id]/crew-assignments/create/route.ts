import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireEditor } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { publicRedirect } from "@/lib/redirect";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await ctx.params;
  const tenant = await requireTenant();
  const actor = await requireEditor(tenant.id);

  const project = await prisma.project.findFirst({ where: { id: projectId, tenantId: tenant.id } });
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });

  const form = await req.formData();
  const crewName = String(form.get("crewName") ?? "").trim();
  const assignedDateRaw = String(form.get("assignedDate") ?? "");
  if (!crewName || !assignedDateRaw) {
    return NextResponse.json({ error: "crewName and assignedDate required" }, { status: 400 });
  }
  // Schema defaults costCode to "" so the unique index is well-defined.
  // Empty string here means "not assigned to any cost code"; storing ""
  // (rather than null) keeps Postgres + SQLite unique-index semantics
  // consistent because both providers treat null as distinct in unique
  // constraints.
  const costCode = form.get("costCode") ? String(form.get("costCode")) : "";

  // Upsert prevents duplicates when the same crew is rebooked for the same
  // day/cost-code combo (the @@unique on the schema).
  const ca = await prisma.crewAssignment.upsert({
    where: {
      projectId_assignedDate_crewName_costCode: {
        projectId,
        assignedDate: new Date(assignedDateRaw),
        crewName,
        costCode,
      },
    },
    create: {
      projectId,
      crewName,
      costCode,
      assignedDate: new Date(assignedDateRaw),
      foreman: form.get("foreman") ? String(form.get("foreman")) : null,
      activity: form.get("activity") ? String(form.get("activity")) : null,
      plannedHeadcount: form.get("plannedHeadcount") ? Number(form.get("plannedHeadcount")) : 0,
      plannedHours: form.get("plannedHours") ? Number(form.get("plannedHours")) : 0,
      shift: form.get("shift") ? String(form.get("shift")) : null,
      segment: form.get("segment") ? String(form.get("segment")) : null,
      station: form.get("station") ? String(form.get("station")) : null,
      latitude: form.get("latitude") ? Number(form.get("latitude")) : null,
      longitude: form.get("longitude") ? Number(form.get("longitude")) : null,
    },
    update: {
      foreman: form.get("foreman") ? String(form.get("foreman")) : undefined,
      activity: form.get("activity") ? String(form.get("activity")) : undefined,
      plannedHeadcount: form.get("plannedHeadcount") ? Number(form.get("plannedHeadcount")) : undefined,
      plannedHours: form.get("plannedHours") ? Number(form.get("plannedHours")) : undefined,
    },
  });

  await recordAudit({
    tenantId: tenant.id,
    actorId: actor.userId,
    actorName: actor.userName,
    entityType: "CrewAssignment",
    entityId: ca.id,
    action: "CREATE",
    after: { crewName, assignedDate: assignedDateRaw, costCode },
    source: "projects/crew-assignments/create",
  });

  return publicRedirect(req, `/projects/${projectId}/crew`, 303);
}
