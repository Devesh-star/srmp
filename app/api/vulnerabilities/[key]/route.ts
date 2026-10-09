import { NextResponse } from "next/server";
import { requireAuth, parseBody, toErrorResponse } from "@/lib/api/route";
import { libraryService } from "@/services/libraryService";
import { vulnerabilityBodySchema, vulnerabilityKeySchema } from "@/lib/validation/library";
import { AppError } from "@/lib/errors";

export async function GET(req: Request, { params }: { params: Promise<{ key: string }> }) {
  try {
    const ctx = await requireAuth(["admin", "assessor", "viewer"]);
    const { key } = await params;
    if (!vulnerabilityKeySchema.safeParse(key).success) throw new AppError(404, "Not found");
    const result = await libraryService.getVulnerabilityDetail(ctx, key);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ key: string }> }) {
  try {
    const ctx = await requireAuth(["admin"]);
    const { key } = await params;
    if (!vulnerabilityKeySchema.safeParse(key).success) throw new AppError(404, "Not found");
    const body = await parseBody(req);
    const validatedBody = vulnerabilityBodySchema.parse(body);
    const result = await libraryService.updateVulnerability(ctx, key, validatedBody);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ key: string }> }) {
  try {
    const ctx = await requireAuth(["admin"]);
    const { key } = await params;
    if (!vulnerabilityKeySchema.safeParse(key).success) throw new AppError(404, "Not found");
    await libraryService.deleteVulnerability(ctx, key);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
