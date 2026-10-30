import { NextResponse } from "next/server";
import { requireAuth, toErrorResponse } from "@/lib/api/route";
import { assetService } from "@/services/assetService";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth(["admin", "assessor", "viewer"]);
    const { id } = await params;
    const result = await assetService.getAssetById(
      { organizationId: ctx.organizationId, actorId: ctx.actor },
      id
    );
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
