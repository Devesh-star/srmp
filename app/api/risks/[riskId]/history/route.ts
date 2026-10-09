import { NextResponse } from "next/server";
import { requireAuth, toErrorResponse } from "@/lib/api/route";
import { riskService } from "@/services/riskService";
import { riskIdSchema } from "@/lib/validation/risk";
import { AppError } from "@/lib/errors";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ riskId: string }> }
) {
  try {
    const ctx = await requireAuth(["admin", "assessor", "viewer"]);
    const { riskId } = await params;
    if (!riskIdSchema.safeParse(riskId).success) {
      throw new AppError(404, "Risk not found");
    }
    const result = await riskService.getRiskHistory(
      { organizationId: ctx.organizationId, actorId: ctx.actor },
      riskId
    );
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
