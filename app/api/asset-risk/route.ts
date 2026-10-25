import { NextResponse } from "next/server";
import { requireAuth, toErrorResponse } from "@/lib/api/route";
import { assetRiskService } from "@/services/assetRiskService";
import { assetRiskQuerySchema } from "@/lib/validation/dashboard";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth(["admin", "assessor", "viewer"]);
    const { searchParams } = new URL(req.url);
    const raw = Object.fromEntries(searchParams.entries());
    const query = assetRiskQuerySchema.parse(raw);

    const result = await assetRiskService.listAssetRisk(
      { organizationId: ctx.organizationId, actorId: ctx.actor },
      query
    );

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
