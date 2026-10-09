import { NextResponse } from "next/server";
import { requireAuth, parseBody, toErrorResponse } from "@/lib/api/route";
import { riskService } from "@/services/riskService";
import { riskUpdateSchema, riskIdSchema } from "@/lib/validation/risk";
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
    const result = await riskService.getRisk(
      { organizationId: ctx.organizationId, actorId: ctx.actor },
      riskId
    );
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

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
    const input = riskUpdateSchema.parse(body);
    const result = await riskService.updateRisk(
      { organizationId: ctx.organizationId, actorId: ctx.actor },
      riskId,
      input
    );
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ riskId: string }> }
) {
  try {
    const ctx = await requireAuth(["admin"]);
    const { riskId } = await params;
    if (!riskIdSchema.safeParse(riskId).success) {
      throw new AppError(404, "Risk not found");
    }
    await riskService.deleteRisk(
      { organizationId: ctx.organizationId, actorId: ctx.actor },
      riskId
    );
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
