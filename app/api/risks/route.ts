import { NextResponse } from "next/server";
import { requireAuth, parseBody, toErrorResponse } from "@/lib/api/route";
import { riskService } from "@/services/riskService";
import { riskCreateSchema, riskListQuerySchema } from "@/lib/validation/risk";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth(["admin", "assessor", "viewer"]);
    const { searchParams } = new URL(req.url);
    const raw = Object.fromEntries(searchParams.entries());
    const query = riskListQuerySchema.parse(raw);
    const result = await riskService.listRisks(
      { organizationId: ctx.organizationId, actorId: ctx.actor },
      query
    );
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth(["admin", "assessor"]);
    const body = await parseBody(req);
    const input = riskCreateSchema.parse(body);
    const result = await riskService.createRisk(
      { organizationId: ctx.organizationId, actorId: ctx.actor },
      input
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
