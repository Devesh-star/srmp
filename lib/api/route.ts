import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { AppError } from "@/lib/errors";

export async function requireAuth(roles?: string[]) {
  const session = await auth();
  if (!session) {
    throw new AppError(401, "Unauthorized");
  }
  const userRole = (session as any).user?.role || "viewer";
  if (roles && !roles.includes(userRole)) {
    throw new AppError(403, "Forbidden");
  }
  return {
    organizationId: (session as any).user?.organizationId || "org_default",
    actor: (session as any).user?.id || "user_default",
    role: userRole
  };
}

export async function parseBody(req: Request) {
  const len = Number(req.headers.get("content-length") || 0);
  if (len > 10240) {
    throw new AppError(413, "Request body too large");
  }
  return req.json();
}

export function toErrorResponse(error: any) {
  if (error instanceof AppError) {
    return NextResponse.json({ message: error.message }, { status: error.statusCode });
  }
  if (error.name === "ZodError") {
    return NextResponse.json({ message: "Validation error", errors: error.errors }, { status: 400 });
  }
  if (error.code === 11000) {
    return NextResponse.json({ message: "An entry with this name already exists" }, { status: 409 });
  }
  console.error("Unhandled error:", error);
  return NextResponse.json({ message: "Internal server error" }, { status: 500 });
}
