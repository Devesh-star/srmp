import { NextResponse } from "next/server";
import { requireAuth, toErrorResponse } from "@/lib/api/route";
import { recommendationService } from "@/services/recommendationService";
import { ASSET_TYPES } from "@/data/types";
import { threatKeySchema } from "@/lib/validation/library";
import { z } from "zod";

const cascadeQuerySchema = z.object({
  assetType: z.enum(ASSET_TYPES),
  threatKey: threatKeySchema.optional(),
});

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth(["admin", "assessor", "viewer"]);
    const { searchParams } = new URL(req.url);
    const query = Object.fromEntries(searchParams.entries());
    const validatedQuery = cascadeQuerySchema.parse(query);
    const result = await recommendationService.getCascade(ctx, validatedQuery);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
