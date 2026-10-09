import { NextResponse } from "next/server";
import { requireAuth, toErrorResponse } from "@/lib/api/route";
import { matrixService } from "@/services/matrixService";
import { matrixQuerySchema } from "@/lib/validation/risk";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth(["admin", "assessor", "viewer"]);
    const { searchParams } = new URL(req.url);
    const raw = Object.fromEntries(searchParams.entries());
    const query = matrixQuerySchema.parse(raw);
    const result = await matrixService.getMatrix(
      { organizationId: ctx.organizationId },
      query
    );
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
