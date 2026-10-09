import mongoose, { Schema, Document, Types } from "mongoose";

export interface IPerRiskSnapshot {
  riskId: string;
  assetId: Types.ObjectId;
  inherentScore: number;
  residualScore: number;
  level: string; // residual level
  status: string;
}

export interface IAssessmentCounts {
  Low: number;
  Medium: number;
  High: number;
  Critical: number;
}

export interface IAssessment extends Document {
  organizationId: string;
  label: string;
  date: Date;
  createdBy: string;
  overallScore: number;
  maxScore: number;
  totalRisks: number;
  counts: IAssessmentCounts;
  inherentOverall: number;
  perRiskSnapshots: IPerRiskSnapshot[];
  createdAt: Date;
  updatedAt: Date;
}

const PerRiskSnapshotSchema = new Schema<IPerRiskSnapshot>(
  {
    riskId: { type: String, required: true },
    assetId: { type: Schema.Types.ObjectId, required: true },
    inherentScore: { type: Number, required: true },
    residualScore: { type: Number, required: true },
    level: { type: String, required: true },
    status: { type: String, required: true },
  },
  { _id: false }
);

const AssessmentSchema = new Schema<IAssessment>(
  {
    organizationId: { type: String, required: true, index: true },
    label: { type: String, required: true },
    date: { type: Date, required: true, default: Date.now },
    createdBy: { type: String, required: true },
    overallScore: { type: Number, required: true },
    maxScore: { type: Number, required: true },
    totalRisks: { type: Number, required: true },
    counts: {
      Low: { type: Number, required: true, default: 0 },
      Medium: { type: Number, required: true, default: 0 },
      High: { type: Number, required: true, default: 0 },
      Critical: { type: Number, required: true, default: 0 },
    },
    inherentOverall: { type: Number, required: true },
    perRiskSnapshots: { type: [PerRiskSnapshotSchema], default: [] },
  },
  {
    timestamps: true,
  }
);

AssessmentSchema.index({ organizationId: 1, date: -1 });

export const Assessment =
  mongoose.models.Assessment ||
  mongoose.model<IAssessment>("Assessment", AssessmentSchema);
