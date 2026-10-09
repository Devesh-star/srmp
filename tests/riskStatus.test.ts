import { describe, it, expect } from "vitest";
import { deriveStatus } from "@/lib/riskStatus";

describe("lib/riskStatus.ts — deriveStatus pure unit tests", () => {
  it("avoid treatment always derives 'Closed'", () => {
    expect(deriveStatus({ treatment: "avoid" })).toBe("Closed");
    expect(
      deriveStatus({
        treatment: "avoid",
        controls: [{ status: "implemented" }],
      })
    ).toBe("Closed");
  });

  it("accept treatment always derives 'Accepted'", () => {
    expect(deriveStatus({ treatment: "accept" })).toBe("Accepted");
    expect(
      deriveStatus({
        treatment: "accept",
        controls: [{ status: "planned" }, { status: "implemented" }],
      })
    ).toBe("Accepted");
  });

  it("transfer treatment always derives 'Mitigated'", () => {
    expect(deriveStatus({ treatment: "transfer" })).toBe("Mitigated");
    expect(
      deriveStatus({
        treatment: "transfer",
        controls: [{ status: "planned" }],
      })
    ).toBe("Mitigated");
  });

  describe("mitigate treatment", () => {
    it("no controls attached -> 'Open'", () => {
      expect(deriveStatus({ treatment: "mitigate", controls: [] })).toBe("Open");
      expect(deriveStatus({ treatment: "mitigate" })).toBe("Open");
    });

    it("at least one planned control -> 'In Treatment'", () => {
      expect(
        deriveStatus({
          treatment: "mitigate",
          controls: [{ status: "planned" }],
        })
      ).toBe("In Treatment");

      expect(
        deriveStatus({
          treatment: "mitigate",
          controls: [
            { status: "implemented" },
            { status: "planned" },
            { status: "implemented" },
          ],
        })
      ).toBe("In Treatment");
    });

    it("at least one control and ALL implemented -> 'Mitigated'", () => {
      expect(
        deriveStatus({
          treatment: "mitigate",
          controls: [{ status: "implemented" }],
        })
      ).toBe("Mitigated");

      expect(
        deriveStatus({
          treatment: "mitigate",
          controls: [
            { status: "implemented" },
            { status: "implemented" },
            { status: "implemented" },
          ],
        })
      ).toBe("Mitigated");
    });
  });
});
