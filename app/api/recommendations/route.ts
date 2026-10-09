import { NextResponse } from "next/server";
import { requireAuth, toErrorResponse } from "@/lib/api/route";
import { recommendationService } from "@/services/recommendationService";
import { recommendationQuerySchema } from "@/lib/validation/library";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth(["admin", "assessor", "viewer"]);
    const { searchParams } = new URL(req.url);
    const query = Object.fromEntries(searchParams.entries());
    const validatedQuery = recommendationQuerySchema.parse(query);
    const result = await recommendationService.getRecommendations(ctx, validatedQuery);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
