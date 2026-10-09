import { AuditLog } from "@/models/AuditLog";
import mongoose from "mongoose";

export async function logAudit(action: string, ctx: { actor: string; organizationId: string }, details?: { targetKey?: string; before?: any; after?: any }) {
  await AuditLog.create({
    action,
    actor: ctx.actor,
    organizationId: ctx.organizationId,
    targetKey: details?.targetKey,
    changes: { before: details?.before, after: details?.after }
  });
}
