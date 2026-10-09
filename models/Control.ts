import mongoose, { Schema, Document } from "mongoose";
import { CostLevel } from "@/data/types";

export interface IControl extends Document {
  organizationId: string | null;
  key: string;
  name: string;
  category: "Technical" | "Administrative" | "Physical";
  description: string;
  effectiveness: number;
  reduces: "likelihood" | "impact";
  implementationCost: CostLevel;
}

const ControlSchema = new Schema<IControl>({
  organizationId: { type: String, default: null },
  key: { type: String, required: true },
  name: { type: String, required: true },
  category: { type: String, required: true },
  description: { type: String, required: true },
  effectiveness: { type: Number, required: true },
  reduces: { type: String, required: true },
  implementationCost: { type: String, required: true },
});

ControlSchema.index({ organizationId: 1, key: 1 }, { unique: true });
ControlSchema.index({ organizationId: 1, name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

export const Control = mongoose.models.Control || mongoose.model<IControl>("Control", ControlSchema);
