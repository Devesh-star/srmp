import { NextResponse } from "next/server";
import { requireAuth, toErrorResponse } from "@/lib/api/route";
import { assetRiskService } from "@/services/assetRiskService";
import { assetRiskDetailQuerySchema } from "@/lib/validation/dashboard";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    const ctx = await requireAuth(["admin", "assessor", "viewer"]);
    const { assetId } = await params;
    const { searchParams } = new URL(req.url);
    const raw = Object.fromEntries(searchParams.entries());
    const query = assetRiskDetailQuerySchema.parse(raw);

    const result = await assetRiskService.getAssetRisk(
      { organizationId: ctx.organizationId, actorId: ctx.actor },
      assetId,
      query
    );

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
