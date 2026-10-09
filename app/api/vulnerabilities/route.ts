import { NextResponse } from "next/server";
import { requireAuth, parseBody, toErrorResponse } from "@/lib/api/route";
import { libraryService } from "@/services/libraryService";
import { vulnerabilityBodySchema, vulnerabilityListQuerySchema } from "@/lib/validation/library";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth(["admin", "assessor", "viewer"]);
    const { searchParams } = new URL(req.url);
    const query = Object.fromEntries(searchParams.entries());
    const validatedQuery = vulnerabilityListQuerySchema.parse(query);
    const result = await libraryService.listVulnerabilities(ctx, validatedQuery);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth(["admin"]);
    const body = await parseBody(req);
    const validatedBody = vulnerabilityBodySchema.parse(body);
    const result = await libraryService.createVulnerability(ctx, validatedBody);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
