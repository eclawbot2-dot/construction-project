import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticate, listEnvelope } from "../_helpers";

/**
 * GET /api/v1/projects — list projects in the token's tenant.
 *
 * Query params:
 *   limit (default 50, max 200)
 *   stage (filter by ProjectStage)
 *   mode  (filter by ProjectMode)
 *
 * Auth: scope "read:projects".
 */
export async function GET(req: NextRequest) {
  const auth = await authenticate(req, "read:projects");
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "50") || 50, 1), 200);
  const stage = url.searchParams.get("stage");
  const mode = url.searchParams.get("mode");

  const where: Record<string, unknown> = { tenantId: auth.tenantId };
  if (stage) where.stage = stage;
  if (mode) where.mode = mode;

  const projects = await prisma.project.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      name: true,
      code: true,
      mode: true,
      stage: true,
      address: true,
      ownerName: true,
      contractValue: true,
      startDate: true,
      createdAt: true,
    },
  });

  return listEnvelope(projects, { hasMore: projects.length === limit });
}
