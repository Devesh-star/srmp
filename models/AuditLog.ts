import mongoose, { Schema, Document } from "mongoose";

export interface IAuditLog extends Document {
  action: string;
  actor: string;
  organizationId: string;
  entityId?: string;          // the document _id as a string (used by risks, assets, etc.)
  targetKey?: string;         // library key (used by library entries)
  changes?: Record<string, unknown>;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>({
  action: { type: String, required: true },
  actor: { type: String, required: true },
  organizationId: { type: String, required: true },
  entityId: { type: String },
  targetKey: { type: String },
  changes: { type: Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now },
});

AuditLogSchema.index({ organizationId: 1, entityId: 1, createdAt: -1 });

export const AuditLog =
  mongoose.models.AuditLog || mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);
