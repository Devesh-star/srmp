import { describe, it, expect } from "vitest";
import {
  dashboardQuerySchema,
  assetRiskQuerySchema,
  assetRiskDetailQuerySchema,
  simulatorParamsSchema,
} from "@/lib/validation/dashboard";

describe("Dashboard & Asset Risk Validation Schemas", () => {
  describe("dashboardQuerySchema", () => {
    it("applies defaults (residual, trendLimit 12)", () => {
      const parsed = dashboardQuerySchema.parse({});
      expect(parsed).toEqual({ basis: "residual", trendLimit: 12 });
    });

    it("accepts valid basis and coerced trendLimit", () => {
      const parsed = dashboardQuerySchema.parse({ basis: "inherent", trendLimit: "30" });
      expect(parsed).toEqual({ basis: "inherent", trendLimit: 30 });
    });

    it("rejects trendLimit outside 1-60", () => {
      expect(() => dashboardQuerySchema.parse({ trendLimit: 0 })).toThrow();
      expect(() => dashboardQuerySchema.parse({ trendLimit: 61 })).toThrow();
    });

    it("rejects unknown properties (strict)", () => {
      expect(() => dashboardQuerySchema.parse({ extra: true })).toThrow();
    });
  });

  describe("assetRiskQuerySchema", () => {
    it("applies defaults", () => {
      const parsed = assetRiskQuerySchema.parse({});
      expect(parsed).toEqual({
        basis: "residual",
        sort: "maxScore",
        order: "desc",
        includeUnassessed: true,
        page: 1,
        limit: 20,
      });
    });

    it("trims search string q", () => {
      const parsed = assetRiskQuerySchema.parse({ q: "  Student DB  " });
      expect(parsed.q).toBe("Student DB");
    });

    it("strictly parses includeUnassessed as 'true' | 'false'", () => {
      const t = assetRiskQuerySchema.parse({ includeUnassessed: "true" });
      expect(t.includeUnassessed).toBe(true);

      const f = assetRiskQuerySchema.parse({ includeUnassessed: "false" });
      expect(f.includeUnassessed).toBe(false);

      expect(() => assetRiskQuerySchema.parse({ includeUnassessed: "1" })).toThrow();
      expect(() => assetRiskQuerySchema.parse({ includeUnassessed: "yes" })).toThrow();
    });

    it("validates type against ASSET_TYPES", () => {
      const parsed = assetRiskQuerySchema.parse({ type: "Database" });
      expect(parsed.type).toBe("Database");

      expect(() => assetRiskQuerySchema.parse({ type: "UnknownType" })).toThrow();
    });
  });

  describe("assetRiskDetailQuerySchema", () => {
    it("applies defaults (residual, includeClosed false)", () => {
      const parsed = assetRiskDetailQuerySchema.parse({});
      expect(parsed).toEqual({ basis: "residual", includeClosed: false });
    });

    it("strictly parses includeClosed", () => {
      const t = assetRiskDetailQuerySchema.parse({ includeClosed: "true" });
      expect(t.includeClosed).toBe(true);

      expect(() => assetRiskDetailQuerySchema.parse({ includeClosed: "yes" })).toThrow();
    });
  });

  describe("simulatorParamsSchema", () => {
    it("validates riskId format", () => {
      const valid = simulatorParamsSchema.parse({ riskId: "R001" });
      expect(valid.riskId).toBe("R001");

      expect(() => simulatorParamsSchema.parse({ riskId: "invalid" })).toThrow();
    });

    it("parses comma-separated controls, drops bad keys, dedupes, caps at 20", () => {
      const controls = "ctl_rbac, ctl_mfa, invalid_key, ctl_rbac";
      const parsed = simulatorParamsSchema.parse({ controls });
      expect(parsed.controls).toEqual(["ctl_rbac", "ctl_mfa"]);
    });
  });
});
