import { describe, it, expect } from "vitest";
import {
  levelOrder,
  toDistributionSeries,
  toCategorySeries,
  mergeTrendWithLive,
  describeChange,
  moveItem,
  parseSimulatorParams,
  buildSimulatorUrl,
} from "@/lib/charts/helpers";

describe("Chart & Simulator Helpers (lib/charts/helpers.ts)", () => {
  it("levelOrder defines standard 4-level sequence", () => {
    expect(levelOrder).toEqual(["Low", "Medium", "High", "Critical"]);
  });

  it("toDistributionSeries reshapes distribution data for charts", () => {
    const input = [
      { level: "Low" as const, count: 5 },
      { level: "Medium" as const, count: 3 },
      { level: "High" as const, count: 2 },
      { level: "Critical" as const, count: 1 },
    ];
    const series = toDistributionSeries(input);
    expect(series).toHaveLength(4);
    expect(series[0]).toEqual({ name: "Low", level: "Low", count: 5 });
    expect(series[3]).toEqual({ name: "Critical", level: "Critical", count: 1 });
  });

  it("toCategorySeries reshapes category breakdown data", () => {
    const input = [
      { category: "Cyber", Low: 2, Medium: 1, High: 1, Critical: 1, total: 5 },
      { category: "Physical", Low: 1, Medium: 0, High: 0, Critical: 0, total: 1 },
    ];
    const series = toCategorySeries(input);
    expect(series).toEqual(input);
  });

  it("mergeTrendWithLive appends live point flagged isLive: true", () => {
    const trend = [
      {
        id: "snap1",
        label: "Baseline",
        date: "2026-01-01T00:00:00.000Z",
        overallScore: 72,
        inherentOverall: 72,
        maxScore: 20,
        counts: { Low: 0, Medium: 1, High: 2, Critical: 3 },
      },
    ];
    const live = {
      overallScore: 48,
      inherentOverall: 72,
      maxScore: 16,
      counts: { Low: 2, Medium: 2, High: 1, Critical: 1 },
      date: "2026-03-01T00:00:00.000Z",
    };

    const merged = mergeTrendWithLive(trend, live);
    expect(merged).toHaveLength(2);
    expect(merged[0].isLive).toBe(false);
    expect(merged[1]).toEqual({
      id: "live",
      label: "Live",
      date: live.date,
      overallScore: 48,
      inherentOverall: 72,
      maxScore: 16,
      counts: live.counts,
      isLive: true,
    });
  });

  it("mergeTrendWithLive still appends live point even if overall and counts match last snapshot", () => {
    const trend = [
      {
        id: "snap1",
        label: "Current state",
        date: "2026-02-01T00:00:00.000Z",
        overallScore: 50,
        inherentOverall: 70,
        maxScore: 15,
        counts: { Low: 1, Medium: 2, High: 1, Critical: 0 },
      },
    ];
    const live = {
      overallScore: 50,
      inherentOverall: 70,
      maxScore: 15,
      counts: { Low: 1, Medium: 2, High: 1, Critical: 0 },
      date: "2026-02-01T12:00:00.000Z",
    };

    const merged = mergeTrendWithLive(trend, live);
    expect(merged).toHaveLength(2);
    expect(merged[1].label).toBe("Live");
    expect(merged[1].isLive).toBe(true);
  });

  describe("describeChange", () => {
    it("returns 'same' when |delta| < 0.05", () => {
      expect(describeChange(0)).toEqual({ direction: "same", text: "same" });
      expect(describeChange(0.04)).toEqual({ direction: "same", text: "same" });
      expect(describeChange(-0.04)).toEqual({ direction: "same", text: "same" });
      expect(describeChange(0.049)).toEqual({ direction: "same", text: "same" });
    });

    it("returns 'down' with rounded magnitude when delta is negative (delta <= -0.05)", () => {
      expect(describeChange(-12.42)).toEqual({ direction: "down", text: "down 12.4" });
      expect(describeChange(-0.05)).toEqual({ direction: "down", text: "down 0.1" });
      expect(describeChange(-3.2)).toEqual({ direction: "down", text: "down 3.2" });
    });

    it("returns 'up' with rounded magnitude when delta is positive (delta >= 0.05)", () => {
      expect(describeChange(4.68)).toEqual({ direction: "up", text: "up 4.7" });
      expect(describeChange(0.05)).toEqual({ direction: "up", text: "up 0.1" });
      expect(describeChange(10)).toEqual({ direction: "up", text: "up 10" });
    });
  });

  describe("moveItem", () => {
    const list = ["A", "B", "C", "D"];

    it("moves item up correctly", () => {
      const moved = moveItem(list, 2, "up"); // 'C' up
      expect(moved).toEqual(["A", "C", "B", "D"]);
      expect(list).toEqual(["A", "B", "C", "D"]); // no mutation
    });

    it("moves item down correctly", () => {
      const moved = moveItem(list, 1, "down"); // 'B' down
      expect(moved).toEqual(["A", "C", "B", "D"]);
      expect(list).toEqual(["A", "B", "C", "D"]);
    });

    it("returns equal copy on boundary moves (first up or last down)", () => {
      expect(moveItem(list, 0, "up")).toEqual(list);
      expect(moveItem(list, 3, "down")).toEqual(list);
    });

    it("returns equal copy on out-of-range index", () => {
      expect(moveItem(list, -1, "up")).toEqual(list);
      expect(moveItem(list, 10, "down")).toEqual(list);
    });
  });

  describe("parseSimulatorParams & buildSimulatorUrl", () => {
    it("parses valid riskId and controls", () => {
      const params = new URLSearchParams("riskId=R001&controls=ctl_mfa,ctl_rbac");
      const res = parseSimulatorParams(params);
      expect(res.riskId).toBe("R001");
      expect(res.controls).toEqual(["ctl_mfa", "ctl_rbac"]);
    });

    it("drops invalid control keys, dedupes and caps at 20", () => {
      const controls = [
        "ctl_mfa",
        "bad_key",
        "ctl_mfa", // duplicate
        "ctl_rbac",
        ...Array.from({ length: 25 }, (_, i) => `ctl_extra_${i}`),
      ].join(",");
      const res = parseSimulatorParams(`?riskId=R100&controls=${controls}`);
      expect(res.riskId).toBe("R100");
      expect(res.controls).not.toContain("bad_key");
      expect(new Set(res.controls).size).toBe(res.controls.length); // unique
      expect(res.controls.length).toBe(20); // capped at 20
    });

    it("rejects bad riskId format by omitting riskId but preserving valid controls", () => {
      const res = parseSimulatorParams("?riskId=INVALID&controls=ctl_mfa");
      expect(res.riskId).toBeUndefined();
      expect(res.controls).toEqual(["ctl_mfa"]);
    });

    it("handles empty or undefined params gracefully", () => {
      expect(parseSimulatorParams(undefined)).toEqual({ controls: [] });
      expect(parseSimulatorParams("")).toEqual({ riskId: undefined, controls: [] });
    });

    it("buildSimulatorUrl builds correct URL and round-trips with parseSimulatorParams", () => {
      const url = buildSimulatorUrl("R001", ["ctl_mfa", "ctl_rbac"]);
      expect(url).toBe("/simulator?riskId=R001&controls=ctl_mfa%2Cctl_rbac");

      const parsed = parseSimulatorParams(url.replace("/simulator", ""));
      expect(parsed.riskId).toBe("R001");
      expect(parsed.controls).toEqual(["ctl_mfa", "ctl_rbac"]);
    });

    it("buildSimulatorUrl without arguments returns /simulator", () => {
      expect(buildSimulatorUrl()).toBe("/simulator");
      expect(buildSimulatorUrl(undefined, [])).toBe("/simulator");
    });
  });
});
