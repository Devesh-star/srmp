import { NextResponse } from "next/server";
import { requireAuth, toErrorResponse } from "@/lib/api/route";
import { assessmentService } from "@/services/assessmentService";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth(["admin", "assessor", "viewer"]);
    const { id } = await params;
    const result = await assessmentService.getAssessment(
      { organizationId: ctx.organizationId },
      id
    );
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth(["admin"]);
    const { id } = await params;
    await assessmentService.deleteAssessment(
      { organizationId: ctx.organizationId, actorId: ctx.actor },
      id
    );
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
