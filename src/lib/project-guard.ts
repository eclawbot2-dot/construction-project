import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import type { Prisma } from "@prisma/client";

/**
 * Fetch a project by id, but only if it belongs to the currently active tenant.
 * If the project belongs to a different tenant (or doesn't exist), 404 the request.
 */
export async function requireProjectForTenant<T extends Prisma.ProjectInclude>(
  projectId: string,
  include: T,
) {
  const tenant = await requireTenant();
  const project = await prisma.project.findFirst({
    where: { id: projectId, tenantId: tenant.id },
    include,
  });
  if (!project) notFound();
  return project;
}
