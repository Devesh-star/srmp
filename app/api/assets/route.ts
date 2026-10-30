import { NextResponse } from "next/server";
import { requireAuth, parseBody, toErrorResponse } from "@/lib/api/route";
import { assetService } from "@/services/assetService";
import { assetCreateSchema, assetListQuerySchema } from "@/lib/validation/asset";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth(["admin", "assessor", "viewer"]);
    const { searchParams } = new URL(req.url);
    const raw = Object.fromEntries(searchParams.entries());
    const query = assetListQuerySchema.parse(raw);
    const result = await assetService.listAssets(
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
    const input = assetCreateSchema.parse(body);
    const result = await assetService.createAsset(
      { organizationId: ctx.organizationId, actorId: ctx.actor },
      input
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
