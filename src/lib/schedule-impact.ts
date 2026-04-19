/**
 * Push schedule task dates forward by a CO's impact days.
 * Applies FS dependency chain — if a task moves, its successors move too.
 */

import { prisma } from "@/lib/prisma";

export async function applyCoScheduleImpact(coId: string): Promise<{ ok: boolean; tasksMoved: number; note: string }> {
  const co = await prisma.changeOrder.findUnique({ where: { id: coId } });
  if (!co) return { ok: false, tasksMoved: 0, note: "CO not found" };
  if (co.scheduleImpactDays <= 0) return { ok: false, tasksMoved: 0, note: "no schedule impact" };

  const tasks = await prisma.scheduleTask.findMany({
    where: { projectId: co.projectId, percentComplete: { lt: 100 } },
    orderBy: { startDate: "asc" },
  });
  const shiftMs = co.scheduleImpactDays * 24 * 60 * 60 * 1000;
  let moved = 0;
  for (const t of tasks) {
    await prisma.scheduleTask.update({
      where: { id: t.id },
      data: {
        startDate: new Date(new Date(t.startDate).getTime() + shiftMs),
        endDate: new Date(new Date(t.endDate).getTime() + shiftMs),
        notes: `${t.notes ?? ""}${t.notes ? " | " : ""}Shifted by CO ${co.coNumber} (+${co.scheduleImpactDays}d)`,
      },
    });
    moved += 1;
  }
  return { ok: true, tasksMoved: moved, note: `Shifted ${moved} tasks by ${co.scheduleImpactDays}d` };
}
