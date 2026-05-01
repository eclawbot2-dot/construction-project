import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireEditor } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { publicRedirect } from "@/lib/redirect";
import { DrawingDiscipline } from "@prisma/client";

const VALID_DISCIPLINES: DrawingDiscipline[] = [
  "ARCHITECTURAL",
  "STRUCTURAL",
  "MEP",
  "CIVIL",
  "LANDSCAPE",
  "ELECTRICAL",
  "PLUMBING",
  "MECHANICAL",
  "FIRE_PROTECTION",
  "OTHER",
];

export async function POST(req: Request) {
  const tenant = await requireTenant();
  const actor = await requireEditor(tenant.id);
  const form = await req.formData();

  const projectId = String(form.get("projectId") ?? "").trim();
  const setName = String(form.get("setName") ?? "").trim();
  const disciplineRaw = String(form.get("discipline") ?? "OTHER");
  const discipline: DrawingDiscipline = VALID_DISCIPLINES.includes(disciplineRaw as DrawingDiscipline)
    ? (disciplineRaw as DrawingDiscipline)
    : "OTHER";

  if (!projectId || !setName) return NextResponse.json({ error: "projectId and setName required" }, { status: 400 });
  const project = await prisma.project.findFirst({ where: { id: projectId, tenantId: tenant.id } });
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });

  const drawing = await prisma.drawing.create({
    data: {
      projectId,
      setName,
      discipline,
      revisionNumber: Number(form.get("revisionNumber") ?? 0) || 0,
      issuedDate: form.get("issuedDate") ? new Date(String(form.get("issuedDate"))) : null,
      notes: form.get("notes") ? String(form.get("notes")) : null,
    },
  });

  await recordAudit({
    tenantId: tenant.id,
    actorId: actor.userId,
    actorName: actor.userName,
    entityType: "Drawing",
    entityId: drawing.id,
    action: "CREATE",
    after: { setName, discipline, projectId },
    source: "drawings/create",
  });

  return publicRedirect(req, `/projects/${projectId}/drawings`, 303);
}
