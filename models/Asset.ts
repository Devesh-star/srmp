import mongoose, { Schema, Document, Types } from "mongoose";
import { AssetType, ASSET_TYPES } from "@/data/types";

export interface IAsset extends Document {
  _id: Types.ObjectId;
  organizationId: string;
  name: string;
  type: AssetType;
  owner: string;
  confidentiality: number;  // 1-5
  integrity: number;        // 1-5
  availability: number;     // 1-5
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AssetSchema = new Schema<IAsset>(
  {
    organizationId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ASSET_TYPES, required: true },
    owner: { type: String, required: true, trim: true },
    confidentiality: { type: Number, required: true, min: 1, max: 5 },
    integrity: { type: Number, required: true, min: 1, max: 5 },
    availability: { type: Number, required: true, min: 1, max: 5 },
    description: { type: String },
  },
  { timestamps: true }
);

AssetSchema.index({ organizationId: 1, name: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });

export const Asset = mongoose.models.Asset || mongoose.model<IAsset>("Asset", AssetSchema);
