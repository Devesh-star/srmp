import { NextResponse } from "next/server";
import { requireAuth, parseBody, toErrorResponse } from "@/lib/api/route";
import { simulateRisk } from "@/services/simulationService";
import { simulateSchema, riskIdSchema } from "@/lib/validation/risk";
import { AppError } from "@/lib/errors";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ riskId: string }> }
) {
  try {
    const ctx = await requireAuth(["admin", "assessor", "viewer"]);
    const { riskId } = await params;
    if (!riskIdSchema.safeParse(riskId).success) {
      throw new AppError(404, "Risk not found");
    }
    const body = await parseBody(req);
    const input = simulateSchema.parse(body);
    const result = await simulateRisk(
      { organizationId: ctx.organizationId },
      riskId,
      input
    );
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
