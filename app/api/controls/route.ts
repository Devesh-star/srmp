import { NextResponse } from "next/server";
import { requireAuth, parseBody, toErrorResponse } from "@/lib/api/route";
import { libraryService } from "@/services/libraryService";
import { controlBodySchema, controlListQuerySchema } from "@/lib/validation/library";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth(["admin", "assessor", "viewer"]);
    const { searchParams } = new URL(req.url);
    const query = Object.fromEntries(searchParams.entries());
    const validatedQuery = controlListQuerySchema.parse(query);
    const result = await libraryService.listControls(ctx, validatedQuery);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth(["admin"]);
    const body = await parseBody(req);
    const validatedBody = controlBodySchema.parse(body);
    const result = await libraryService.createControl(ctx, validatedBody);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
