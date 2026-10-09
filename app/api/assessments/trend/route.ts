import { NextResponse } from "next/server";
import { requireAuth, toErrorResponse } from "@/lib/api/route";
import { assessmentService } from "@/services/assessmentService";
import { trendQuerySchema } from "@/lib/validation/risk";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth(["admin", "assessor", "viewer"]);
    const { searchParams } = new URL(req.url);
    const raw = Object.fromEntries(searchParams.entries());
    const query = trendQuerySchema.parse(raw);
    const result = await assessmentService.getTrend(
      { organizationId: ctx.organizationId },
      query
    );
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
