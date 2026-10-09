import mongoose, { Schema, Document } from "mongoose";

export interface IAuditLog extends Document {
  action: string;
  actor: string;
  organizationId: string;
  targetKey?: string;
  changes?: Record<string, any>;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>({
  action: { type: String, required: true },
  actor: { type: String, required: true },
  organizationId: { type: String, required: true },
  targetKey: { type: String },
  changes: { type: Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now }
});

export const AuditLog = mongoose.models.AuditLog || mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);
