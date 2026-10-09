export type RiskStatus = "Open" | "In Treatment" | "Mitigated" | "Accepted" | "Closed";
export type RiskTreatment = "mitigate" | "avoid" | "transfer" | "accept";

export interface StatusInput {
  treatment: RiskTreatment;
  controls?: { status: "planned" | "implemented" }[];
}

/**
 * Derives the operational risk status purely from treatment and attached controls.
 *
 * Rules:
 * - "avoid" -> "Closed" (avoiding the activity terminates the risk and closes it)
 * - "accept" -> "Accepted" (risk accepted by authorized governance)
 * - "transfer" -> "Mitigated" (risk transferred, e.g. via insurance or contract)
 * - "mitigate":
 *     - No controls attached: "Open"
 *     - At least one control with status "planned": "In Treatment"
 *     - At least one control and ALL attached controls are "implemented": "Mitigated"
 *
 * Note: "Mitigated" means every attached control is implemented; the residual level
 * displayed alongside the status reflects how far the risk actually dropped.
 */
export function deriveStatus(input: StatusInput): RiskStatus {
  switch (input.treatment) {
    case "avoid":
      return "Closed";
    case "accept":
      return "Accepted";
    case "transfer":
      return "Mitigated";
    case "mitigate": {
      const controls = input.controls ?? [];
      if (controls.length === 0) {
        return "Open";
      }
      const hasPlanned = controls.some((c) => c.status === "planned");
      if (hasPlanned) {
        return "In Treatment";
      }
      // All controls implemented
      return "Mitigated";
    }
    default: {
      const exhaustiveCheck: never = input.treatment;
      throw new Error(`Unhandled treatment: ${exhaustiveCheck}`);
    }
  }
}
