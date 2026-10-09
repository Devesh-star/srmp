import { Counter } from "@/models/Counter";

/**
 * Atomically increments the sequence for a given org + name and returns the new value.
 * A failed insert after nextSequence may leave a gap in numbering; this is acceptable.
 */
export async function nextSequence(organizationId: string, name: string): Promise<number> {
  const key = `${organizationId}:${name}`;
  const doc = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, returnDocument: "after" }
  );
  return doc!.seq;
}

/**
 * Formats a risk sequence number as R001, R002, … (minimum 3 digits).
 */
export function formatRiskId(seq: number): string {
  return `R${String(seq).padStart(3, "0")}`;
}
