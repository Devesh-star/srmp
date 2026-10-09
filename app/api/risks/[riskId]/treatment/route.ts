import { NextResponse } from "next/server";
import { requireAuth, parseBody, toErrorResponse } from "@/lib/api/route";
import { riskService } from "@/services/riskService";
import { treatmentSchema, riskIdSchema } from "@/lib/validation/risk";
import { AppError } from "@/lib/errors";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ riskId: string }> }
) {
  try {
    const ctx = await requireAuth(["admin", "assessor"]);
    const { riskId } = await params;
    if (!riskIdSchema.safeParse(riskId).success) {
      throw new AppError(404, "Risk not found");
    }
    const body = await parseBody(req);
    const input = treatmentSchema.parse(body);
    const result = await riskService.setRiskTreatment(
      { organizationId: ctx.organizationId, actorId: ctx.actor },
      riskId,
      input,
      ctx.role
    );
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
