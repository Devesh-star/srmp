import mongoose, { Schema, Document } from "mongoose";
import { AssetType, CiaTarget } from "@/data/types";

export interface IThreat extends Document {
  organizationId: string | null;
  key: string;
  name: string;
  category: "Cyber" | "Physical" | "Environmental" | "Human";
  description: string;
  potentialImpact: string;
  ciaTarget: CiaTarget;
  applicableAssetTypes: AssetType[];
  vulnerabilityKeys: string[];
}

const ThreatSchema = new Schema<IThreat>({
  organizationId: { type: String, default: null },
  key: { type: String, required: true },
  name: { type: String, required: true },
  category: { type: String, required: true },
  description: { type: String, required: true },
  potentialImpact: { type: String, required: true },
  ciaTarget: { type: String, required: true },
  applicableAssetTypes: [{ type: String }],
  vulnerabilityKeys: [{ type: String }],
});

ThreatSchema.index({ organizationId: 1, key: 1 }, { unique: true });
ThreatSchema.index({ organizationId: 1, name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

export const Threat = mongoose.models.Threat || mongoose.model<IThreat>("Threat", ThreatSchema);
