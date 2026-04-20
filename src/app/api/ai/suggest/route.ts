import { NextResponse } from "next/server";
import { suggestNaics, suggestCostCode } from "@/lib/copilot-ai";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");
  const input = url.searchParams.get("input") ?? "";
  if (!kind || !input) return NextResponse.json({ suggestions: [] });
  if (kind === "naics") return NextResponse.json({ suggestions: suggestNaics(input) });
  if (kind === "costCode") return NextResponse.json({ suggestions: suggestCostCode(input) });
  return NextResponse.json({ suggestions: [] });
}
