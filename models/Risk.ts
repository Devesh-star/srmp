import mongoose, { Schema, Document, Types } from "mongoose";

export type RiskStatus = "Open" | "In Treatment" | "Mitigated" | "Accepted" | "Closed";
export type RiskTreatment = "mitigate" | "avoid" | "transfer" | "accept";

export interface IRiskControl {
  controlId: string;   // library control key (e.g. ctl_rbac)
  status: "planned" | "implemented";
  implementedAt?: string | null; // ISO datetime string or null
}

export interface IRisk extends Document {
  organizationId: string;
  riskId: string;           // R001, R002, …
  assetId: Types.ObjectId;  // ref to Asset
  threatId: string;         // library threat key
  vulnerabilityId: string;  // library vulnerability key

  likelihood: number;       // 1-5 integer (inherent)
  impact: number;           // 1-5 integer (inherent, user-chosen)
  suggestedImpact: number;  // computed from asset CIA + threat.ciaTarget
  impactOverridden: boolean;

  inherentScore: number;
  inherentLevel: string;

  residualLikelihood: number;
  residualImpact: number;
  residualScore: number;
  residualLevel: string;

  treatment: RiskTreatment;
  transferFactor?: number;
  treatmentDetails?: Record<string, unknown> | null;
  controls: IRiskControl[];

  status: RiskStatus;
  owner: string;
  dueDate?: string | null;  // YYYY-MM-DD or null
  notes: string;

  createdAt: Date;
  updatedAt: Date;
}

const RiskControlSchema = new Schema<IRiskControl>({
  controlId: { type: String, required: true },
  status: { type: String, enum: ["planned", "implemented"], required: true },
  implementedAt: { type: String, default: null },
}, { _id: false });

const RiskSchema = new Schema<IRisk>({
  organizationId: { type: String, required: true, index: true },
  riskId: { type: String, required: true },
  assetId: { type: Schema.Types.ObjectId, required: true },
  threatId: { type: String, required: true },
  vulnerabilityId: { type: String, required: true },

  likelihood: { type: Number, required: true, min: 1, max: 5 },
  impact: { type: Number, required: true, min: 1, max: 5 },
  suggestedImpact: { type: Number, required: true, min: 1, max: 5 },
  impactOverridden: { type: Boolean, required: true, default: false },

  inherentScore: { type: Number, required: true },
  inherentLevel: { type: String, required: true },

  residualLikelihood: { type: Number, required: true },
  residualImpact: { type: Number, required: true },
  residualScore: { type: Number, required: true },
  residualLevel: { type: String, required: true },

  treatment: { type: String, enum: ["mitigate", "avoid", "transfer", "accept"], required: true, default: "mitigate" },
  transferFactor: { type: Number, min: 0, max: 1 },
  treatmentDetails: { type: Schema.Types.Mixed, default: null },
  controls: { type: [RiskControlSchema], default: [] },

  status: { type: String, enum: ["Open", "In Treatment", "Mitigated", "Accepted", "Closed"], required: true, default: "Open" },
  owner: { type: String, required: true },
  dueDate: { type: String, default: null },
  notes: { type: String, default: "" },
}, {
  timestamps: true,
});

// Unique per org + identity triple (among non-Closed)
// The uniqueness is enforced in service code (to allow re-creation after Closed)
RiskSchema.index({ organizationId: 1, riskId: 1 }, { unique: true });
RiskSchema.index({ organizationId: 1, assetId: 1, threatId: 1, vulnerabilityId: 1 });

export const Risk = mongoose.models.Risk || mongoose.model<IRisk>("Risk", RiskSchema);
