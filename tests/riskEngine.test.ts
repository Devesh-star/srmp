import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  score, inherentScore, level, criticality, suggestedImpact, residual,
  computeResidual, simulate, summarize, overallLevel, roundTo,
  RiskControl, AppliedControl, CiaTarget
} from "../lib/riskEngine";
import { controls } from "../data/controls";

describe("riskEngine", () => {
  describe("level()", () => {
    it("handles boundaries correctly", () => {
      expect(level(0)).toBe("Low");
      expect(level(4.99)).toBe("Low");
      expect(level(5)).toBe("Medium");
      expect(level(9.99)).toBe("Medium");
      expect(level(10)).toBe("High");
      expect(level(16.99)).toBe("High");
      expect(level(17)).toBe("Critical");
      expect(level(25)).toBe("Critical");
    });
    it("handles floating-point noise normalization", () => {
      expect(level(4.9999999999)).toBe("Medium");
    });
    it("throws on invalid inputs", () => {
      expect(() => level(-1)).toThrow(RangeError);
      expect(() => level(25.01)).toThrow(RangeError);
      expect(() => level(NaN)).toThrow(TypeError);
      expect(() => level(Infinity)).toThrow(RangeError);
    });
  });

  describe("score and inherentScore", () => {
    it("calculates score correctly", () => {
      expect(score(4, 5)).toBe(20);
      expect(score(2.5, 2.5)).toBe(6.25);
    });
    it("rejects invalid inputs for score", () => {
      expect(() => score(0.99, 5)).toThrow(RangeError);
      expect(() => score(5, 6)).toThrow(RangeError);
    });
    it("calculates inherentScore correctly for integers", () => {
      expect(inherentScore(4, 5)).toBe(20);
    });
    it("rejects invalid inputs for inherentScore", () => {
      expect(() => inherentScore(0, 5)).toThrow(RangeError);
      expect(() => inherentScore(6, 5)).toThrow(RangeError);
      expect(() => inherentScore(2.5, 5)).toThrow(TypeError);
      expect(() => inherentScore(NaN, 5)).toThrow(TypeError);
    });
    it("yields identical integer product results", () => {
      const results = new Set<number>();
      for (let i = 1; i <= 5; i++) {
        for (let j = 1; j <= 5; j++) {
          expect(inherentScore(i, j)).toBe(i * j);
          expect(score(i, j)).toBe(i * j);
          results.add(i * j);
        }
      }
      expect(Array.from(results).sort((a,b)=>a-b)).toEqual([1,2,3,4,5,6,8,9,10,12,15,16,20,25]);
    });
  });

  describe("criticality and suggestedImpact", () => {
    it("calculates criticality", () => {
      expect(criticality(5, 5, 4)).toBeCloseTo(4.6666, 3);
      expect(criticality(3, 3, 3)).toBe(3);
    });
    it("rejects invalid inputs for criticality", () => {
      expect(() => criticality(0, 5, 5)).toThrow(RangeError);
      expect(() => criticality(5.5, 5, 5)).toThrow(TypeError);
    });
    it("suggestedImpact returns correctly", () => {
      const asset = { confidentiality: 5, integrity: 4, availability: 3 };
      expect(suggestedImpact(asset, "C")).toBe(5);
      expect(suggestedImpact(asset, "I")).toBe(4);
      expect(suggestedImpact(asset, "A")).toBe(3);
      expect(() => suggestedImpact(asset, "X" as unknown as CiaTarget)).toThrow();
    });
  });

  describe("residual()", () => {
    it("returns inherent if no controls", () => {
      expect(residual(4, 5, [])).toEqual({ likelihood: 4, impact: 5, score: 20, level: "Critical" });
    });

    it("calculates ABC University residual correctly", () => {
      const ctlRbac: RiskControl = { id: "ctl_rbac", effectiveness: 0.30, reduces: "likelihood", status: "implemented" };
      const ctlMfa: RiskControl = { id: "ctl_mfa", effectiveness: 0.25, reduces: "likelihood", status: "implemented" };
      const ctlMon: RiskControl = { id: "ctl_access_monitoring", effectiveness: 0.10, reduces: "likelihood", status: "implemented" };
      const ctlEnc: RiskControl = { id: "ctl_db_encryption", effectiveness: 0.20, reduces: "impact", status: "implemented" };
      
      const res = residual(4, 5, [ctlRbac, ctlMfa, ctlMon, ctlEnc]);
      expect(res.likelihood).toBeCloseTo(4 * 0.70 * 0.75 * 0.90, 2); // 1.89
      expect(res.impact).toBeCloseTo(5 * 0.80, 2); // 4.0
      expect(res.score).toBeCloseTo(1.89 * 4.0, 2); // 7.56
      expect(res.level).toBe("Medium");
    });

    it("ignores planned controls", () => {
      const ctlMfa: RiskControl = { id: "ctl_mfa", effectiveness: 0.25, reduces: "likelihood", status: "planned" };
      const res = residual(4, 5, [ctlMfa]);
      expect(res.score).toBe(20);
    });

    it("floors dimensions at 1", () => {
      const c1: RiskControl = { id: "c1", effectiveness: 0.9, reduces: "likelihood", status: "implemented" };
      const c2: RiskControl = { id: "c2", effectiveness: 0.9, reduces: "likelihood", status: "implemented" };
      const res = residual(2, 5, [c1, c2]);
      expect(res.likelihood).toBe(1);
      expect(res.score).toBe(5);
    });

    it("order of controls does not change the result", () => {
      const c1: RiskControl = { id: "c1", effectiveness: 0.3, reduces: "likelihood", status: "implemented" };
      const c2: RiskControl = { id: "c2", effectiveness: 0.4, reduces: "impact", status: "implemented" };
      const r1 = residual(5, 5, [c1, c2]);
      const r2 = residual(5, 5, [c2, c1]);
      expect(r1).toEqual(r2);
    });

    it("handles boundary effectiveness (0 and 1)", () => {
      const c0: RiskControl = { id: "c0", effectiveness: 0, reduces: "likelihood", status: "implemented" };
      expect(residual(4, 5, [c0]).likelihood).toBe(4);
      
      const c1: RiskControl = { id: "c1", effectiveness: 1, reduces: "likelihood", status: "implemented" };
      expect(residual(4, 5, [c1]).likelihood).toBe(1);
    });

    it("throws on invalid effectiveness or inputs", () => {
      expect(() => residual(4, 5, [{ id: "c", effectiveness: -0.1, reduces: "likelihood", status: "implemented" }])).toThrow(RangeError);
      expect(() => residual(4, 5, [{ id: "c", effectiveness: 1.1, reduces: "likelihood", status: "implemented" }])).toThrow(RangeError);
      expect(() => residual(4, 5, [
        { id: "c1", effectiveness: 0.5, reduces: "likelihood", status: "implemented" },
        { id: "c1", effectiveness: 0.5, reduces: "likelihood", status: "implemented" }
      ])).toThrow(Error);
      expect(() => residual(0, 5, [])).toThrow(RangeError);
      expect(() => residual(4, 6, [])).toThrow(RangeError);
    });

    it("does not mutate the input array", () => {
      const arr: RiskControl[] = [{ id: "c", effectiveness: 0.5, reduces: "likelihood", status: "implemented" }];
      const arrCopy = [...arr];
      residual(4, 5, arr);
      expect(arr).toEqual(arrCopy);
    });
  });

  describe("computeResidual()", () => {
    it("mitigate matches residual()", () => {
      const c1: RiskControl = { id: "c1", effectiveness: 0.5, reduces: "likelihood", status: "implemented" };
      const res = computeResidual({ likelihood: 4, impact: 4, treatment: "mitigate", controls: [c1] });
      expect(res.likelihood).toBe(2);
    });
    
    it("accept equals inherent even with implemented controls", () => {
      const c1: RiskControl = { id: "c1", effectiveness: 0.5, reduces: "likelihood", status: "implemented" };
      const res = computeResidual({ likelihood: 4, impact: 4, treatment: "accept", controls: [c1] });
      expect(res.score).toBe(16);
    });

    it("handles transfer treatment properly", () => {
      const res = computeResidual({ likelihood: 4, impact: 5, treatment: "transfer", transferFactor: 0.4 });
      expect(res.impact).toBe(3);
      expect(res.score).toBe(12);
      expect(res.level).toBe("High");
      
      const resFloor = computeResidual({ likelihood: 4, impact: 5, treatment: "transfer", transferFactor: 1 });
      expect(resFloor.impact).toBe(1);

      expect(() => computeResidual({ likelihood: 4, impact: 5, treatment: "transfer" })).toThrow(TypeError);
      expect(() => computeResidual({ likelihood: 4, impact: 5, treatment: "transfer", transferFactor: 1.5 })).toThrow(RangeError);
    });

    it("handles avoid treatment", () => {
      const res = computeResidual({ likelihood: 4, impact: 5, treatment: "avoid" });
      expect(res).toEqual({ likelihood: 0, impact: 0, score: 0, level: "Low" });
    });
  });

  describe("simulate()", () => {
    it("simulates controls accurately", () => {
      const c1: AppliedControl = { id: "c1", effectiveness: 0.4, reduces: "likelihood" };
      const c2: AppliedControl = { id: "c2", effectiveness: 0.4, reduces: "impact" };
      const res = simulate(5, 5, [c1, c2]);
      
      expect(res.baseline.score).toBe(25);
      expect(res.steps[0].scoreAfter).toBe(15);
      expect(res.steps[0].delta).toBe(-10);
      expect(res.steps[1].scoreAfter).toBe(9);
      expect(res.steps[1].delta).toBe(-6);
      expect(res.final.score).toBe(9);

      const c3: AppliedControl = { id: "c3", effectiveness: 0.3, reduces: "likelihood" };
      const res3 = simulate(5, 5, [c1, c2, c3]);
      expect(res3.final.score).toBeCloseTo(6.3, 2);
    });

    it("scoreAfter never exceeds scoreBefore", () => {
      const c1: AppliedControl = { id: "c1", effectiveness: 0.2, reduces: "likelihood" };
      const res = simulate(2, 2, [c1]);
      for (const step of res.steps) {
        expect(step.scoreAfter).toBeLessThanOrEqual(step.scoreBefore);
      }
    });

    it("final equals residual() regardless of order", () => {
      const c1: AppliedControl = { id: "c1", effectiveness: 0.4, reduces: "likelihood" };
      const c2: AppliedControl = { id: "c2", effectiveness: 0.4, reduces: "impact" };
      const r1 = simulate(5, 5, [c1, c2]).final;
      const r2 = simulate(5, 5, [c2, c1]).final;
      expect(r1).toEqual(r2);

      const resControl: RiskControl = { ...c1, status: "implemented" };
      const resControl2: RiskControl = { ...c2, status: "implemented" };
      expect(r1).toEqual(residual(5, 5, [resControl, resControl2]));
    });

    it("handles empty control list", () => {
      const res = simulate(4, 5, []);
      expect(res.steps.length).toBe(0);
      expect(res.final).toEqual(res.baseline);
    });

    it("throws on duplicate ids", () => {
      const c1: AppliedControl = { id: "c1", effectiveness: 0.2, reduces: "likelihood" };
      expect(() => simulate(5, 5, [c1, c1])).toThrow(Error);
    });
  });

  describe("summarize, overallLevel, roundTo", () => {
    it("summarize works as expected", () => {
      const s = summarize([20, 10, 5, 2]);
      expect(s.overall).toBe(37); // round(100 * 37 / (4 * 25)) = round(3700 / 100) = 37
      expect(s.max).toBe(20);
      expect(s.counts).toEqual({ Critical: 1, High: 1, Medium: 1, Low: 1 });
      expect(s.total).toBe(4);
    });

    it("handles empty arrays in summarize", () => {
      const s = summarize([]);
      expect(s).toEqual({ overall: 0, max: 0, total: 0, counts: { Critical: 0, High: 0, Medium: 0, Low: 0 } });
    });

    it("handles 100 overall", () => {
      expect(summarize([25, 25]).overall).toBe(100);
      expect(summarize([1]).overall).toBe(4);
    });

    it("overallLevel thresholds", () => {
      expect(overallLevel(19)).toBe("Low");
      expect(overallLevel(20)).toBe("Medium");
      expect(overallLevel(39)).toBe("Medium");
      expect(overallLevel(40)).toBe("High");
      expect(overallLevel(67)).toBe("High");
      expect(overallLevel(68)).toBe("Critical");
    });

    it("roundTo helper", () => {
      expect(roundTo(7.56, 1)).toBe(7.6);
      const r = roundTo(1.005, 2);
      expect(r === 1.01 || r === 1).toBe(true);
    });
  });

  describe("Integration with seed data", () => {
    it("ABC University residual test", () => {
      const getControl = (id: string): RiskControl => {
        const c = controls.find(c => c.id === id);
        if (!c) throw new Error("not found");
        return { ...c, status: "implemented" };
      };
      const arr = [
        getControl("ctl_rbac"), getControl("ctl_mfa"), 
        getControl("ctl_access_monitoring"), getControl("ctl_db_encryption")
      ];
      const res = residual(4, 5, arr);
      expect(res.score).toBeCloseTo(7.56, 1);
      expect(res.level).toBe("Medium");
    });

    it("simulate strictly decreasing scores", () => {
      const getControl = (id: string): AppliedControl => {
        const c = controls.find(c => c.id === id);
        if (!c) throw new Error("not found");
        return c;
      };
      const arr = [
        getControl("ctl_edr"), getControl("ctl_offline_backup"), 
        getControl("ctl_patch_management"), getControl("ctl_network_segmentation")
      ];
      const res = simulate(5, 5, arr);
      let lastScore = res.baseline.score;
      for (const step of res.steps) {
        expect(step.scoreAfter).toBeLessThan(lastScore);
        lastScore = step.scoreAfter;
      }
    });
  });

  describe("Architecture guard test", () => {
    it("lib/riskEngine.ts contains no import statements", () => {
      const p = path.join(__dirname, "../lib/riskEngine.ts");
      const content = fs.readFileSync(p, "utf-8");
      // Check that there is no import line (excluding potential comments if any, but regex is simple enough)
      expect(content).not.toMatch(/^import\s+/m);
      expect(content).not.toMatch(/require\(/m);
    });
  });
});
