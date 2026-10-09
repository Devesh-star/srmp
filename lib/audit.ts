import { AuditLog } from "@/models/AuditLog";

interface AuditCtx {
  actor: string;
  organizationId: string;
}

interface AuditDetails {
  entityId?: string;  // document _id as string (risks, assets)
  targetKey?: string; // library key (threats, vulnerabilities, controls)
  before?: unknown;
  after?: unknown;
}

export async function logAudit(
  action: string,
  ctx: AuditCtx,
  details?: AuditDetails
): Promise<void> {
  await AuditLog.create({
    action,
    actor: ctx.actor,
    organizationId: ctx.organizationId,
    entityId: details?.entityId,
    targetKey: details?.targetKey,
    changes: { before: details?.before ?? null, after: details?.after ?? null },
  });
}
