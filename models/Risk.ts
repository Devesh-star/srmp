import mongoose, { Schema, Document } from "mongoose";

export interface IRisk extends Document {
  organizationId: string;
  threatId: string; // Wait, actually the prompt says "referenced by any Risk (threatId)" meaning it stores the key? Let's use `threatKey` or whatever the tests use. Ah, "referenced by any Risk (threatId)" - the prompt explicitly said threatId, vulnerabilityId, controls[].controlId.
  vulnerabilityId: string;
  controls: { controlId: string }[];
}

const RiskSchema = new Schema<IRisk>({
  organizationId: { type: String, required: true },
  threatId: { type: String, required: true },
  vulnerabilityId: { type: String, required: true },
  controls: [{ controlId: { type: String, required: true } }],
});

export const Risk = mongoose.models.Risk || mongoose.model<IRisk>("Risk", RiskSchema);
