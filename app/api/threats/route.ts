import { NextResponse } from "next/server";
import { requireAuth, parseBody, toErrorResponse } from "@/lib/api/route";
import { libraryService } from "@/services/libraryService";
import { threatBodySchema, threatListQuerySchema } from "@/lib/validation/library";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth(["admin", "assessor", "viewer"]);
    const { searchParams } = new URL(req.url);
    const query = Object.fromEntries(searchParams.entries());
    const validatedQuery = threatListQuerySchema.parse(query);
    const result = await libraryService.listThreats(ctx, validatedQuery);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth(["admin"]);
    const body = await parseBody(req);
    const validatedBody = threatBodySchema.parse(body);
    const result = await libraryService.createThreat(ctx, validatedBody);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
