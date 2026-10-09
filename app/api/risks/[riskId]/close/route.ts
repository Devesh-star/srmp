import { NextResponse } from "next/server";
import { requireAuth, parseBody, toErrorResponse } from "@/lib/api/route";
import { riskService } from "@/services/riskService";
import { closeSchema, riskIdSchema } from "@/lib/validation/risk";
import { AppError } from "@/lib/errors";

export async function POST(
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
    const input = closeSchema.parse(body);
    const result = await riskService.closeRisk(
      { organizationId: ctx.organizationId, actorId: ctx.actor },
      riskId,
      input
    );
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
