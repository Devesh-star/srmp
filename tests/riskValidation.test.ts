import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  riskCreateSchema,
  riskUpdateSchema,
  riskListQuerySchema,
  matrixQuerySchema,
  riskIdSchema,
  controlsReplaceSchema,
  treatmentSchema,
  closeSchema,
  reopenSchema,
  simulateSchema,
  assessmentCreateSchema,
  assessmentListQuerySchema,
  trendQuerySchema,
} from "@/lib/validation/risk";

describe("Risk validation schemas", () => {
  // ── riskIdSchema ────────────────────────────────────────────────────────────
  describe("riskIdSchema", () => {
    it("accepts valid IDs", () => {
      expect(riskIdSchema.safeParse("R001").success).toBe(true);
      expect(riskIdSchema.safeParse("R999").success).toBe(true);
      expect(riskIdSchema.safeParse("R1000").success).toBe(true);
    });
    it("rejects invalid IDs", () => {
      expect(riskIdSchema.safeParse("R01").success).toBe(false); // < 3 digits
      expect(riskIdSchema.safeParse("r001").success).toBe(false); // lowercase
      expect(riskIdSchema.safeParse("001").success).toBe(false); // no R prefix
    });
  });

  // ── riskCreateSchema ────────────────────────────────────────────────────────
  describe("riskCreateSchema", () => {
    const valid = {
      assetId: "a".repeat(24),
      threatKey: "thr_data_breach",
      vulnerabilityKey: "vul_weak_access_control",
      likelihood: 4,
      impact: 5,
      owner: "Alice",
      notes: "",
    };

    it("accepts valid body", () => {
      expect(riskCreateSchema.safeParse(valid).success).toBe(true);
    });

    it("accepts optional dueDate with valid calendar date", () => {
      expect(
        riskCreateSchema.safeParse({ ...valid, dueDate: "2027-06-15" }).success
      ).toBe(true);
    });

    it("rejects likelihood/impact out of bounds", () => {
      expect(riskCreateSchema.safeParse({ ...valid, likelihood: 0 }).success).toBe(false);
      expect(riskCreateSchema.safeParse({ ...valid, impact: 6 }).success).toBe(false);
      expect(riskCreateSchema.safeParse({ ...valid, likelihood: 2.5 }).success).toBe(false);
      expect(
        riskCreateSchema.safeParse({ ...valid, impact: "3" as unknown as number })
          .success
      ).toBe(false);
    });

    it("rejects invalid dueDate (non-existent calendar date)", () => {
      expect(riskCreateSchema.safeParse({ ...valid, dueDate: "2026-02-30" }).success).toBe(false);
      expect(riskCreateSchema.safeParse({ ...valid, dueDate: "2026-13-01" }).success).toBe(false);
      expect(riskCreateSchema.safeParse({ ...valid, dueDate: "1999-12-31" }).success).toBe(false);
      expect(riskCreateSchema.safeParse({ ...valid, dueDate: "2101-01-01" }).success).toBe(false);
    });

    it("rejects unknown keys (strict)", () => {
      expect(riskCreateSchema.safeParse({ ...valid, organizationId: "org1" }).success).toBe(false);
      expect(riskCreateSchema.safeParse({ ...valid, riskId: "R001" }).success).toBe(false);
      expect(riskCreateSchema.safeParse({ ...valid, inherentScore: 20 }).success).toBe(false);
      expect(riskCreateSchema.safeParse({ ...valid, residualScore: 20 }).success).toBe(false);
      expect(riskCreateSchema.safeParse({ ...valid, status: "Open" }).success).toBe(false);
      expect(riskCreateSchema.safeParse({ ...valid, treatment: "mitigate" }).success).toBe(false);
      expect(riskCreateSchema.safeParse({ ...valid, controls: [] }).success).toBe(false);
    });
  });

  // ── riskUpdateSchema ────────────────────────────────────────────────────────
  describe("riskUpdateSchema", () => {
    const validUpdate = {
      likelihood: 3,
      impact: 4,
      owner: "Bob",
      notes: "Updated",
      expectedUpdatedAt: "2026-10-01T12:00:00.000Z",
    };

    it("accepts valid update body", () => {
      expect(riskUpdateSchema.safeParse(validUpdate).success).toBe(true);
    });

    it("accepts null dueDate (clear)", () => {
      expect(
        riskUpdateSchema.safeParse({ ...validUpdate, dueDate: null }).success
      ).toBe(true);
    });

    it("requires expectedUpdatedAt", () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { expectedUpdatedAt: _token, ...noToken } = validUpdate;
      expect(riskUpdateSchema.safeParse(noToken).success).toBe(false);
    });

    it("rejects identity and phase-6 fields (strict)", () => {
      expect(riskUpdateSchema.safeParse({ ...validUpdate, assetId: "a".repeat(24) }).success).toBe(false);
      expect(riskUpdateSchema.safeParse({ ...validUpdate, threatKey: "thr_x" }).success).toBe(false);
      expect(riskUpdateSchema.safeParse({ ...validUpdate, vulnerabilityKey: "vul_x" }).success).toBe(false);
      expect(riskUpdateSchema.safeParse({ ...validUpdate, status: "Open" }).success).toBe(false);
      expect(riskUpdateSchema.safeParse({ ...validUpdate, treatment: "accept" }).success).toBe(false);
      expect(riskUpdateSchema.safeParse({ ...validUpdate, controls: [] }).success).toBe(false);
      expect(riskUpdateSchema.safeParse({ ...validUpdate, residualScore: 5 }).success).toBe(false);
      expect(riskUpdateSchema.safeParse({ ...validUpdate, organizationId: "org1" }).success).toBe(false);
      expect(riskUpdateSchema.safeParse({ ...validUpdate, riskId: "R001" }).success).toBe(false);
    });

    it("rejects L/I out of range", () => {
      expect(riskUpdateSchema.safeParse({ ...validUpdate, likelihood: 0 }).success).toBe(false);
      expect(riskUpdateSchema.safeParse({ ...validUpdate, impact: 6 }).success).toBe(false);
    });
  });

  // ── controlsReplaceSchema ───────────────────────────────────────────────────
  describe("controlsReplaceSchema", () => {
    const valid = {
      controls: [
        { controlKey: "ctl_rbac", status: "implemented" },
        { controlKey: "ctl_mfa", status: "planned" },
      ],
      expectedUpdatedAt: "2026-10-01T12:00:00.000Z",
    };

    it("accepts valid controls list", () => {
      expect(controlsReplaceSchema.safeParse(valid).success).toBe(true);
    });

    it("rejects duplicate control keys", () => {
      const dup = {
        controls: [
          { controlKey: "ctl_rbac", status: "implemented" },
          { controlKey: "ctl_rbac", status: "planned" },
        ],
        expectedUpdatedAt: "2026-10-01T12:00:00.000Z",
      };
      expect(controlsReplaceSchema.safeParse(dup).success).toBe(false);
    });

    it("rejects more than 20 controls", () => {
      const tooMany = {
        controls: Array.from({ length: 21 }, (_, i) => ({
          controlKey: `ctl_test_${i}`,
          status: "planned",
        })),
        expectedUpdatedAt: "2026-10-01T12:00:00.000Z",
      };
      expect(controlsReplaceSchema.safeParse(tooMany).success).toBe(false);
    });

    it("rejects invalid status or malformed control key", () => {
      expect(
        controlsReplaceSchema.safeParse({
          controls: [{ controlKey: "invalid_prefix", status: "planned" }],
          expectedUpdatedAt: "2026-10-01T12:00:00.000Z",
        }).success
      ).toBe(false);

      expect(
        controlsReplaceSchema.safeParse({
          controls: [{ controlKey: "ctl_rbac", status: "unknown" }],
          expectedUpdatedAt: "2026-10-01T12:00:00.000Z",
        }).success
      ).toBe(false);
    });

    it("rejects unknown keys and client implementedAt (strict)", () => {
      expect(
        controlsReplaceSchema.safeParse({
          controls: [
            {
              controlKey: "ctl_rbac",
              status: "implemented",
              implementedAt: "2026-10-01T12:00:00.000Z",
            },
          ],
          expectedUpdatedAt: "2026-10-01T12:00:00.000Z",
        }).success
      ).toBe(false);

      expect(
        controlsReplaceSchema.safeParse({
          ...valid,
          status: "Mitigated",
        }).success
      ).toBe(false);
    });
  });

  // ── treatmentSchema ─────────────────────────────────────────────────────────
  describe("treatmentSchema", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-10-10T12:00:00.000Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("accepts valid mitigate", () => {
      expect(
        treatmentSchema.safeParse({
          treatment: "mitigate",
          expectedUpdatedAt: "2026-10-01T12:00:00.000Z",
        }).success
      ).toBe(true);
    });

    it("accepts valid accept with future reviewDate within 730 days", () => {
      expect(
        treatmentSchema.safeParse({
          treatment: "accept",
          justification: "Risk accepted by executive team due to prohibitive cost.",
          approver: "CISO John Doe",
          reviewDate: "2027-04-10",
          expectedUpdatedAt: "2026-10-01T12:00:00.000Z",
        }).success
      ).toBe(true);
    });

    it("rejects accept with past reviewDate or today", () => {
      // Past
      expect(
        treatmentSchema.safeParse({
          treatment: "accept",
          justification: "Risk accepted by executive team due to prohibitive cost.",
          approver: "CISO John Doe",
          reviewDate: "2026-10-09",
          expectedUpdatedAt: "2026-10-01T12:00:00.000Z",
        }).success
      ).toBe(false);

      // Today
      expect(
        treatmentSchema.safeParse({
          treatment: "accept",
          justification: "Risk accepted by executive team due to prohibitive cost.",
          approver: "CISO John Doe",
          reviewDate: "2026-10-10",
          expectedUpdatedAt: "2026-10-01T12:00:00.000Z",
        }).success
      ).toBe(false);
    });

    it("rejects accept with reviewDate > 730 days in future", () => {
      // 730 days from 2026-10-10 is 2028-10-09
      expect(
        treatmentSchema.safeParse({
          treatment: "accept",
          justification: "Risk accepted by executive team due to prohibitive cost.",
          approver: "CISO John Doe",
          reviewDate: "2028-10-15", // > 730 days
          expectedUpdatedAt: "2026-10-01T12:00:00.000Z",
        }).success
      ).toBe(false);
    });

    it("rejects accept with justification < 10 characters", () => {
      expect(
        treatmentSchema.safeParse({
          treatment: "accept",
          justification: "Too short", // 9 chars
          approver: "CISO John Doe",
          reviewDate: "2027-04-10",
          expectedUpdatedAt: "2026-10-01T12:00:00.000Z",
        }).success
      ).toBe(false);
    });

    it("accepts valid transfer with transferFactor between 0.05 and 0.90", () => {
      expect(
        treatmentSchema.safeParse({
          treatment: "transfer",
          justification: "Cyber insurance policy covering up to $5M loss.",
          transferFactor: 0.4,
          expectedUpdatedAt: "2026-10-01T12:00:00.000Z",
        }).success
      ).toBe(true);
    });

    it("rejects transfer with out-of-range factor or string factor", () => {
      expect(
        treatmentSchema.safeParse({
          treatment: "transfer",
          justification: "Cyber insurance policy covering up to $5M loss.",
          transferFactor: 0.04, // < 0.05
          expectedUpdatedAt: "2026-10-01T12:00:00.000Z",
        }).success
      ).toBe(false);

      expect(
        treatmentSchema.safeParse({
          treatment: "transfer",
          justification: "Cyber insurance policy covering up to $5M loss.",
          transferFactor: 0.91, // > 0.90
          expectedUpdatedAt: "2026-10-01T12:00:00.000Z",
        }).success
      ).toBe(false);

      expect(
        treatmentSchema.safeParse({
          treatment: "transfer",
          justification: "Cyber insurance policy covering up to $5M loss.",
          transferFactor: "0.3" as unknown as number,
          expectedUpdatedAt: "2026-10-01T12:00:00.000Z",
        }).success
      ).toBe(false);
    });

    it("accepts valid avoid with avoidReason >= 10 chars", () => {
      expect(
        treatmentSchema.safeParse({
          treatment: "avoid",
          avoidReason: "Decommissioning vulnerable legacy service next month.",
          expectedUpdatedAt: "2026-10-01T12:00:00.000Z",
        }).success
      ).toBe(true);

      expect(
        treatmentSchema.safeParse({
          treatment: "avoid",
          avoidReason: "Too short", // 9 chars
          expectedUpdatedAt: "2026-10-01T12:00:00.000Z",
        }).success
      ).toBe(false);
    });
  });

  // ── closeSchema & reopenSchema ──────────────────────────────────────────────
  describe("closeSchema & reopenSchema", () => {
    it("accepts valid close with reason >= 10 chars", () => {
      expect(
        closeSchema.safeParse({
          reason: "Risk resolved after complete hardware replacement.",
          expectedUpdatedAt: "2026-10-01T12:00:00.000Z",
        }).success
      ).toBe(true);

      expect(
        closeSchema.safeParse({
          reason: "Too short",
          expectedUpdatedAt: "2026-10-01T12:00:00.000Z",
        }).success
      ).toBe(false);
    });

    it("accepts valid reopenSchema with expectedUpdatedAt", () => {
      expect(
        reopenSchema.safeParse({
          expectedUpdatedAt: "2026-10-01T12:00:00.000Z",
        }).success
      ).toBe(true);

      expect(reopenSchema.safeParse({}).success).toBe(false);
    });
  });

  // ── simulateSchema ──────────────────────────────────────────────────────────
  describe("simulateSchema", () => {
    it("accepts 0 to 20 unique control keys", () => {
      expect(simulateSchema.safeParse({ controlKeys: [] }).success).toBe(true);
      expect(
        simulateSchema.safeParse({
          controlKeys: ["ctl_rbac", "ctl_mfa", "ctl_db_encryption"],
        }).success
      ).toBe(true);
    });

    it("rejects duplicates and > 20 control keys", () => {
      expect(
        simulateSchema.safeParse({
          controlKeys: ["ctl_rbac", "ctl_rbac"],
        }).success
      ).toBe(false);

      expect(
        simulateSchema.safeParse({
          controlKeys: Array.from({ length: 21 }, (_, i) => `ctl_${i}`),
        }).success
      ).toBe(false);
    });
  });

  // ── assessment schemas ──────────────────────────────────────────────────────
  describe("assessment schemas", () => {
    it("assessmentCreateSchema accepts optional label", () => {
      expect(assessmentCreateSchema.safeParse({}).success).toBe(true);
      expect(
        assessmentCreateSchema.safeParse({ label: "Q3 2026 Baseline" }).success
      ).toBe(true);
      expect(
        assessmentCreateSchema.safeParse({ label: "a".repeat(81) }).success
      ).toBe(false);
    });

    it("assessmentListQuerySchema validates pagination limits", () => {
      expect(assessmentListQuerySchema.safeParse({ page: 1, limit: 20 }).success).toBe(true);
      expect(assessmentListQuerySchema.safeParse({ limit: 51 }).success).toBe(false);
    });

    it("trendQuerySchema validates limit", () => {
      expect(trendQuerySchema.parse({}).limit).toBe(24);
      expect(trendQuerySchema.safeParse({ limit: 61 }).success).toBe(false);
      expect(trendQuerySchema.safeParse({ limit: 0 }).success).toBe(false);
    });
  });

  // ── riskListQuerySchema ─────────────────────────────────────────────────────
  describe("riskListQuerySchema", () => {
    it("supports all 5 operational statuses", () => {
      for (const st of ["Open", "In Treatment", "Mitigated", "Accepted", "Closed"]) {
        expect(riskListQuerySchema.safeParse({ status: st }).success).toBe(true);
      }
    });
  });

  // ── matrixQuerySchema ───────────────────────────────────────────────────────
  describe("matrixQuerySchema", () => {
    it("defaults: residual basis, includeClosed false", () => {
      const r = matrixQuerySchema.parse({});
      expect(r.basis).toBe("residual");
      expect(r.includeClosed).toBe(false);
    });

    it("parses includeClosed true/false strictly", () => {
      expect(matrixQuerySchema.parse({ includeClosed: "true" }).includeClosed).toBe(true);
      expect(matrixQuerySchema.parse({ includeClosed: "false" }).includeClosed).toBe(false);
      expect(matrixQuerySchema.safeParse({ includeClosed: "1" }).success).toBe(false);
      expect(matrixQuerySchema.safeParse({ includeClosed: "yes" }).success).toBe(false);
    });
  });
});
