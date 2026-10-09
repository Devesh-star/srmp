import mongoose, { Schema } from "mongoose";

export interface ICounter {
  _id: string; // "<organizationId>:<sequenceName>"
  seq: number;
}

const CounterSchema = new Schema<ICounter>({
  _id: { type: String, required: true },
  seq: { type: Number, required: true, default: 0 },
}, { _id: false });

export const Counter = mongoose.models.Counter || mongoose.model<ICounter>("Counter", CounterSchema);
