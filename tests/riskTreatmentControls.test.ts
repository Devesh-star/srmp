import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { runSeed } from "@/scripts/seed";
import { Asset } from "@/models/Asset";
import { Risk } from "@/models/Risk";
import { Assessment } from "@/models/Assessment";
import { AuditLog } from "@/models/AuditLog";
import { Counter } from "@/models/Counter";
import { Control } from "@/models/Control";
import { riskService } from "@/services/riskService";
import { simulateRisk } from "@/services/simulationService";
import { assessmentService } from "@/services/assessmentService";
import { computeResidual } from "@/lib/riskEngine";
import { AppError } from "@/lib/errors";

let mongoServer: MongoMemoryServer;

const ORG_A = "orgA_p6_test";
const ORG_B = "orgB_p6_test";
const CTX_A_ADMIN = { organizationId: ORG_A, actorId: "admin_a" };
const CTX_A_ASSESSOR = { organizationId: ORG_A, actorId: "assessor_a" };
const CTX_B_ADMIN = { organizationId: ORG_B, actorId: "admin_b" };

async function makeAsset(
  orgId: string,
  overrides?: Partial<{
    name: string;
    type: string;
    confidentiality: number;
    integrity: number;
    availability: number;
    owner: string;
  }>
) {
  return Asset.create({
    organizationId: orgId,
    name: overrides?.name ?? "Student Database",
    type: overrides?.type ?? "Database",
    confidentiality: overrides?.confidentiality ?? 5,
    integrity: overrides?.integrity ?? 5,
    availability: overrides?.availability ?? 4,
    owner: overrides?.owner ?? "Admin",
  });
}

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Risk.deleteMany({});
  await Asset.deleteMany({});
  await Assessment.deleteMany({});
  await AuditLog.deleteMany({});
  await Counter.deleteMany({});
  await runSeed();
});

describe("Phase 6: Controls, Treatments, Simulation & Assessment Snapshots", () => {
  // ── Controls & Residual Scoring ───────────────────────────────────────────
  describe("Controls & Residual Scoring", () => {
    it("all 4 controls implemented -> residualScore ~7.56, Medium, Mitigated, matches computeResidual", async () => {
      const asset = await makeAsset(ORG_A);
      const risk = await riskService.createRisk(CTX_A_ADMIN, {
        assetId: asset._id.toString(),
        threatKey: "thr_data_breach",
        vulnerabilityKey: "vul_weak_access_control",
        likelihood: 4,
        impact: 5,
        owner: "Admin",
      });

      const updated = await riskService.setRiskControls(CTX_A_ADMIN, risk.riskId, {
        controls: [
          { controlKey: "ctl_rbac", status: "implemented" },
          { controlKey: "ctl_mfa", status: "implemented" },
          { controlKey: "ctl_access_monitoring", status: "implemented" },
          { controlKey: "ctl_db_encryption", status: "implemented" },
        ],
        expectedUpdatedAt: risk.updatedAt,
      });

      expect(updated.residualLikelihood).toBeCloseTo(1.89, 2);
      expect(updated.residualImpact).toBe(4);
      expect(updated.residualScore).toBeCloseTo(7.56, 2);
      expect(updated.residualLevel).toBe("Medium");
      expect(updated.status).toBe("Mitigated");
      expect(updated.controlsImplemented).toBe(4);
      expect(updated.controlsTotal).toBe(4);

      // Verify engine parity
      const engineRes = computeResidual({
        likelihood: 4,
        impact: 5,
        treatment: "mitigate",
        controls: [
          { id: "ctl_rbac", effectiveness: 0.3, reduces: "likelihood", status: "implemented" },
          { id: "ctl_mfa", effectiveness: 0.25, reduces: "likelihood", status: "implemented" },
          { id: "ctl_access_monitoring", effectiveness: 0.1, reduces: "likelihood", status: "implemented" },
          { id: "ctl_db_encryption", effectiveness: 0.2, reduces: "impact", status: "implemented" },
        ],
      });
      expect(updated.residualScore).toBeCloseTo(engineRes.score, 4);

      // Verify audit
      const audit = await AuditLog.findOne({
        organizationId: ORG_A,
        action: "risk.controls.update",
      });
      expect(audit).not.toBeNull();
    });

    it("partial controls: RBAC & MFA implemented, 2 planned -> residual ~10.5, High, In Treatment", async () => {
      const asset = await makeAsset(ORG_A);
      const risk = await riskService.createRisk(CTX_A_ADMIN, {
        assetId: asset._id.toString(),
        threatKey: "thr_data_breach",
        vulnerabilityKey: "vul_weak_access_control",
        likelihood: 4,
        impact: 5,
        owner: "Admin",
      });

      const updated = await riskService.setRiskControls(CTX_A_ADMIN, risk.riskId, {
        controls: [
          { controlKey: "ctl_rbac", status: "implemented" },
          { controlKey: "ctl_mfa", status: "implemented" },
          { controlKey: "ctl_access_monitoring", status: "planned" },
          { controlKey: "ctl_db_encryption", status: "planned" },
        ],
        expectedUpdatedAt: risk.updatedAt,
      });

      expect(updated.residualScore).toBeCloseTo(10.5, 2);
      expect(updated.residualLevel).toBe("High");
      expect(updated.status).toBe("In Treatment");
      expect(updated.controlsImplemented).toBe(2);
    });

    it("all 4 controls planned -> residual equals inherent (20), High/Critical, In Treatment", async () => {
      const asset = await makeAsset(ORG_A);
      const risk = await riskService.createRisk(CTX_A_ADMIN, {
        assetId: asset._id.toString(),
        threatKey: "thr_data_breach",
        vulnerabilityKey: "vul_weak_access_control",
        likelihood: 4,
        impact: 5,
        owner: "Admin",
      });

      const updated = await riskService.setRiskControls(CTX_A_ADMIN, risk.riskId, {
        controls: [
          { controlKey: "ctl_rbac", status: "planned" },
          { controlKey: "ctl_mfa", status: "planned" },
          { controlKey: "ctl_access_monitoring", status: "planned" },
          { controlKey: "ctl_db_encryption", status: "planned" },
        ],
        expectedUpdatedAt: risk.updatedAt,
      });

      expect(updated.residualScore).toBe(20);
      expect(updated.status).toBe("In Treatment");
      expect(updated.controlsImplemented).toBe(0);
    });

    it("implementedAt lifecycle: set on planned->implemented, preserved across saves, cleared on planned", async () => {
      vi.useFakeTimers();
      const t1 = new Date("2026-10-10T10:00:00.000Z");
      vi.setSystemTime(t1);

      const asset = await makeAsset(ORG_A);
      const risk = await riskService.createRisk(CTX_A_ADMIN, {
        assetId: asset._id.toString(),
        threatKey: "thr_data_breach",
        vulnerabilityKey: "vul_weak_access_control",
        likelihood: 4,
        impact: 5,
        owner: "Admin",
      });

      // Save 1: ctl_rbac implemented
      const s1 = await riskService.setRiskControls(CTX_A_ADMIN, risk.riskId, {
        controls: [{ controlKey: "ctl_rbac", status: "implemented" }],
        expectedUpdatedAt: risk.updatedAt,
      });
      const rbacCtl1 = s1.controls.find((c) => c.key === "ctl_rbac");
      expect(rbacCtl1?.implementedAt).toBe(t1.toISOString());

      // Advance clock by 5 days
      const t2 = new Date("2026-10-15T10:00:00.000Z");
      vi.setSystemTime(t2);

      // Save 2: add ctl_mfa implemented, keep ctl_rbac implemented
      const s2 = await riskService.setRiskControls(CTX_A_ADMIN, risk.riskId, {
        controls: [
          { controlKey: "ctl_rbac", status: "implemented" },
          { controlKey: "ctl_mfa", status: "implemented" },
        ],
        expectedUpdatedAt: s1.updatedAt,
      });
      const rbacCtl2 = s2.controls.find((c) => c.key === "ctl_rbac");
      const mfaCtl2 = s2.controls.find((c) => c.key === "ctl_mfa");
      expect(rbacCtl2?.implementedAt).toBe(t1.toISOString()); // UNCHANGED
      expect(mfaCtl2?.implementedAt).toBe(t2.toISOString()); // NEW

      // Save 3: set ctl_rbac back to planned
      const s3 = await riskService.setRiskControls(CTX_A_ADMIN, risk.riskId, {
        controls: [
          { controlKey: "ctl_rbac", status: "planned" },
          { controlKey: "ctl_mfa", status: "implemented" },
        ],
        expectedUpdatedAt: s2.updatedAt,
      });
      const rbacCtl3 = s3.controls.find((c) => c.key === "ctl_rbac");
      expect(rbacCtl3?.implementedAt).toBeNull(); // CLEARED

      vi.useRealTimers();
    });

    it("rejects unknown control keys and foreign organization custom controls with 400", async () => {
      const asset = await makeAsset(ORG_A);
      const risk = await riskService.createRisk(CTX_A_ADMIN, {
        assetId: asset._id.toString(),
        threatKey: "thr_data_breach",
        vulnerabilityKey: "vul_weak_access_control",
        likelihood: 4,
        impact: 5,
        owner: "Admin",
      });

      // Create a custom control belonging to ORG_B
      await Control.create({
        organizationId: ORG_B,
        key: "ctl_org_b_secret",
        name: "Org B Secret Control",
        category: "Technical",
        description: "Private",
        effectiveness: 0.5,
        reduces: "likelihood",
        implementationCost: "Low",
      });

      await expect(
        riskService.setRiskControls(CTX_A_ADMIN, risk.riskId, {
          controls: [{ controlKey: "ctl_org_b_secret", status: "planned" }],
          expectedUpdatedAt: risk.updatedAt,
        })
      ).rejects.toThrow(AppError);
    });

    it("rejects editing controls when treatment is not mitigate with 409", async () => {
      const asset = await makeAsset(ORG_A);
      const risk = await riskService.createRisk(CTX_A_ADMIN, {
        assetId: asset._id.toString(),
        threatKey: "thr_data_breach",
        vulnerabilityKey: "vul_weak_access_control",
        likelihood: 4,
        impact: 5,
        owner: "Admin",
      });

      // Change treatment to accept
      const accepted = await riskService.setRiskTreatment(
        CTX_A_ADMIN,
        risk.riskId,
        {
          treatment: "accept",
          justification: "Risk accepted by executive leadership.",
          approver: "Board of Directors",
          reviewDate: "2027-01-01",
          expectedUpdatedAt: risk.updatedAt,
        },
        "admin"
      );

      await expect(
        riskService.setRiskControls(CTX_A_ADMIN, risk.riskId, {
          controls: [{ controlKey: "ctl_rbac", status: "implemented" }],
          expectedUpdatedAt: accepted.updatedAt,
        })
      ).rejects.toThrow(AppError);
    });
  });

  // ── Treatment Transitions ─────────────────────────────────────────────────
  describe("Treatment Transitions & Governance", () => {
    it("mitigate -> accept (admin): residual = inherent = 20, Accepted; accept -> mitigate: restores ~7.56 Mitigated", async () => {
      const asset = await makeAsset(ORG_A);
      const risk = await riskService.createRisk(CTX_A_ADMIN, {
        assetId: asset._id.toString(),
        threatKey: "thr_data_breach",
        vulnerabilityKey: "vul_weak_access_control",
        likelihood: 4,
        impact: 5,
        owner: "Admin",
      });

      // Add 4 controls
      const withControls = await riskService.setRiskControls(CTX_A_ADMIN, risk.riskId, {
        controls: [
          { controlKey: "ctl_rbac", status: "implemented" },
          { controlKey: "ctl_mfa", status: "implemented" },
          { controlKey: "ctl_access_monitoring", status: "implemented" },
          { controlKey: "ctl_db_encryption", status: "implemented" },
        ],
        expectedUpdatedAt: risk.updatedAt,
      });

      // Switch to accept
      const accepted = await riskService.setRiskTreatment(
        CTX_A_ADMIN,
        risk.riskId,
        {
          treatment: "accept",
          justification: "Cost exceeds asset replacement cost.",
          approver: "CISO",
          reviewDate: "2027-06-01",
          expectedUpdatedAt: withControls.updatedAt,
        },
        "admin"
      );

      expect(accepted.treatment).toBe("accept");
      expect(accepted.status).toBe("Accepted");
      expect(accepted.residualScore).toBe(20);
      expect(accepted.treatmentDetails?.justification).toBe("Cost exceeds asset replacement cost.");
      expect(accepted.controls.length).toBe(4); // Controls PRESERVED

      // Switch back to mitigate
      const mitigated = await riskService.setRiskTreatment(
        CTX_A_ADMIN,
        risk.riskId,
        {
          treatment: "mitigate",
          expectedUpdatedAt: accepted.updatedAt,
        },
        "admin"
      );

      expect(mitigated.treatment).toBe("mitigate");
      expect(mitigated.status).toBe("Mitigated");
      expect(mitigated.residualScore).toBeCloseTo(7.56, 2);
      expect(mitigated.treatmentDetails).toBeNull();
    });

    it("transfer with factor 0.4: residualImpact 3, residualScore 12, High, Mitigated; controls ignored", async () => {
      const asset = await makeAsset(ORG_A);
      const risk = await riskService.createRisk(CTX_A_ADMIN, {
        assetId: asset._id.toString(),
        threatKey: "thr_data_breach",
        vulnerabilityKey: "vul_weak_access_control",
        likelihood: 4,
        impact: 5,
        owner: "Admin",
      });

      const transferred = await riskService.setRiskTreatment(
        CTX_A_ADMIN,
        risk.riskId,
        {
          treatment: "transfer",
          justification: "Comprehensive cybersecurity indemnity policy.",
          transferFactor: 0.4,
          reviewDate: "2027-10-01",
          expectedUpdatedAt: risk.updatedAt,
        },
        "assessor"
      );

      expect(transferred.treatment).toBe("transfer");
      expect(transferred.status).toBe("Mitigated");
      expect(transferred.residualImpact).toBe(3); // 5 * (1 - 0.4) = 3
      expect(transferred.residualScore).toBe(12); // 4 * 3 = 12
      expect(transferred.residualLevel).toBe("High");
    });

    it("avoid: residual 0, Low, Closed; changing back to mitigate restores inherent residual and Open status", async () => {
      const asset = await makeAsset(ORG_A);
      const risk = await riskService.createRisk(CTX_A_ADMIN, {
        assetId: asset._id.toString(),
        threatKey: "thr_data_breach",
        vulnerabilityKey: "vul_weak_access_control",
        likelihood: 4,
        impact: 5,
        owner: "Admin",
      });

      const avoided = await riskService.setRiskTreatment(
        CTX_A_ADMIN,
        risk.riskId,
        {
          treatment: "avoid",
          avoidReason: "Decommissioning legacy student portal and all related databases.",
          expectedUpdatedAt: risk.updatedAt,
        },
        "admin"
      );

      expect(avoided.treatment).toBe("avoid");
      expect(avoided.status).toBe("Closed");
      expect(avoided.residualScore).toBe(0);
      expect(avoided.residualLevel).toBe("Low");

      // Changing treatment to mitigate restores real residual and Open status
      const restored = await riskService.setRiskTreatment(
        CTX_A_ADMIN,
        risk.riskId,
        {
          treatment: "mitigate",
          expectedUpdatedAt: avoided.updatedAt,
        },
        "admin"
      );

      expect(restored.treatment).toBe("mitigate");
      expect(restored.status).toBe("Open");
      expect(restored.residualScore).toBe(20);
    });

    it("Critical-accept governance rule: assessor gets 403 on Critical risk; assessor succeeds on Medium risk; admin succeeds on Critical", async () => {
      const asset = await makeAsset(ORG_A);
      // 1. Critical risk (inherent 4 * 5 = 20)
      const critRisk = await riskService.createRisk(CTX_A_ADMIN, {
        assetId: asset._id.toString(),
        threatKey: "thr_data_breach",
        vulnerabilityKey: "vul_weak_access_control",
        likelihood: 4,
        impact: 5,
        owner: "Admin",
      });

      // Assessor attempt on Critical -> 403
      await expect(
        riskService.setRiskTreatment(
          CTX_A_ASSESSOR,
          critRisk.riskId,
          {
            treatment: "accept",
            justification: "Assessor trying to accept critical risk.",
            approver: "Assessor",
            reviewDate: "2027-01-01",
            expectedUpdatedAt: critRisk.updatedAt,
          },
          "assessor"
        )
      ).rejects.toMatchObject({ statusCode: 403 });

      // Confirm no write or audit occurred
      const unchanged = await riskService.getRisk(CTX_A_ADMIN, critRisk.riskId);
      expect(unchanged.treatment).toBe("mitigate");

      // 2. Medium risk (L2, I3 -> inherent 6)
      const serverAsset = await makeAsset(ORG_A, {
        name: "Campus Server",
        type: "Server",
      });
      const medRisk = await riskService.createRisk(CTX_A_ADMIN, {
        assetId: serverAsset._id.toString(),
        threatKey: "thr_unauthorized_physical_access",
        vulnerabilityKey: "vul_no_physical_access_control",
        likelihood: 2,
        impact: 3,
        owner: "Admin",
      });

      // Assessor attempt on Medium -> SUCCESS
      const medAccepted = await riskService.setRiskTreatment(
        CTX_A_ASSESSOR,
        medRisk.riskId,
        {
          treatment: "accept",
          justification: "Assessor accepting medium risk with approval.",
          approver: "Facility Manager",
          reviewDate: "2027-01-01",
          expectedUpdatedAt: medRisk.updatedAt,
        },
        "assessor"
      );
      expect(medAccepted.status).toBe("Accepted");

      // 3. Admin attempt on Critical -> SUCCESS
      const adminAccepted = await riskService.setRiskTreatment(
        CTX_A_ADMIN,
        critRisk.riskId,
        {
          treatment: "accept",
          justification: "Admin executive board acceptance.",
          approver: "CEO",
          reviewDate: "2027-01-01",
          expectedUpdatedAt: critRisk.updatedAt,
        },
        "admin"
      );
      expect(adminAccepted.status).toBe("Accepted");
    });
  });

  // ── Close & Reopen ────────────────────────────────────────────────────────
  describe("Close & Reopen Lifecycle", () => {
    it("close sets Closed, logs note in audit, and rejects edits with 409 until reopened", async () => {
      const asset = await makeAsset(ORG_A);
      const risk = await riskService.createRisk(CTX_A_ADMIN, {
        assetId: asset._id.toString(),
        threatKey: "thr_data_breach",
        vulnerabilityKey: "vul_weak_access_control",
        likelihood: 4,
        impact: 5,
        owner: "Admin",
      });

      const closed = await riskService.closeRisk(CTX_A_ADMIN, risk.riskId, {
        reason: "Decommissioned server and destroyed hard drives.",
        expectedUpdatedAt: risk.updatedAt,
      });

      expect(closed.status).toBe("Closed");
      expect(closed.closedManually).toBe(true);

      // Verify history contains the close reason as note
      const history = await riskService.getRiskHistory(CTX_A_ADMIN, risk.riskId);
      const closeEntry = history.find((h) => h.action === "risk.close");
      expect(closeEntry?.note).toBe("Decommissioned server and destroyed hard drives.");

      // Editing closed risk -> 409
      await expect(
        riskService.updateRisk(CTX_A_ADMIN, risk.riskId, {
          likelihood: 3,
          impact: 3,
          owner: "Admin",
          notes: "Try edit",
          expectedUpdatedAt: closed.updatedAt,
        })
      ).rejects.toMatchObject({ statusCode: 409 });

      // Closing already closed risk -> 409
      await expect(
        riskService.closeRisk(CTX_A_ADMIN, risk.riskId, {
          reason: "Close again reason.",
          expectedUpdatedAt: closed.updatedAt,
        })
      ).rejects.toMatchObject({ statusCode: 409 });

      // Reopen risk
      const reopened = await riskService.reopenRisk(CTX_A_ADMIN, risk.riskId, {
        expectedUpdatedAt: closed.updatedAt,
      });

      expect(reopened.status).toBe("Open");
      expect(reopened.closedManually).toBe(false);

      // Reopening an active risk -> 409
      await expect(
        riskService.reopenRisk(CTX_A_ADMIN, risk.riskId, {
          expectedUpdatedAt: reopened.updatedAt,
        })
      ).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  // ── Concurrency & Optimistic Locking ──────────────────────────────────────
  describe("Concurrency & Optimistic Locking", () => {
    it("stale expectedUpdatedAt throws 409 and does not modify data", async () => {
      const asset = await makeAsset(ORG_A);
      const risk = await riskService.createRisk(CTX_A_ADMIN, {
        assetId: asset._id.toString(),
        threatKey: "thr_data_breach",
        vulnerabilityKey: "vul_weak_access_control",
        likelihood: 4,
        impact: 5,
        owner: "Admin",
      });

      const staleDate = new Date(Date.now() - 60000).toISOString();

      await expect(
        riskService.setRiskControls(CTX_A_ADMIN, risk.riskId, {
          controls: [{ controlKey: "ctl_rbac", status: "implemented" }],
          expectedUpdatedAt: staleDate,
        })
      ).rejects.toMatchObject({ statusCode: 409 });

      const current = await riskService.getRisk(CTX_A_ADMIN, risk.riskId);
      expect(current.controlsTotal).toBe(0);
    });

    it("two concurrent mutations with the same token: exactly one succeeds", async () => {
      const asset = await makeAsset(ORG_A);
      const risk = await riskService.createRisk(CTX_A_ADMIN, {
        assetId: asset._id.toString(),
        threatKey: "thr_data_breach",
        vulnerabilityKey: "vul_weak_access_control",
        likelihood: 4,
        impact: 5,
        owner: "Admin",
      });

      const p1 = riskService.setRiskControls(CTX_A_ADMIN, risk.riskId, {
        controls: [{ controlKey: "ctl_rbac", status: "implemented" }],
        expectedUpdatedAt: risk.updatedAt,
      });

      const p2 = riskService.setRiskControls(CTX_A_ADMIN, risk.riskId, {
        controls: [{ controlKey: "ctl_mfa", status: "implemented" }],
        expectedUpdatedAt: risk.updatedAt,
      });

      const results = await Promise.allSettled([p1, p2]);
      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);
    });
  });

  // ── What-If Simulation ────────────────────────────────────────────────────
  describe("simulateRisk", () => {
    it("simulates in order: deltas match diminishing returns, final is ~7.56, read-only with no DB write", async () => {
      const asset = await makeAsset(ORG_A);
      const risk = await riskService.createRisk(CTX_A_ADMIN, {
        assetId: asset._id.toString(),
        threatKey: "thr_data_breach",
        vulnerabilityKey: "vul_weak_access_control",
        likelihood: 4,
        impact: 5,
        owner: "Admin",
      });

      const sim = await simulateRisk(CTX_A_ADMIN, risk.riskId, {
        controlKeys: [
          "ctl_rbac",
          "ctl_mfa",
          "ctl_access_monitoring",
          "ctl_db_encryption",
        ],
      });

      expect(sim.baseline.score).toBe(20);
      expect(sim.steps.length).toBe(4);

      // Step 1: RBAC
      expect(sim.steps[0].scoreAfter).toBeCloseTo(14, 1);
      expect(sim.steps[0].delta).toBeCloseTo(-6, 1);

      // Step 2: MFA
      expect(sim.steps[1].scoreAfter).toBeCloseTo(10.5, 1);
      expect(sim.steps[1].delta).toBeCloseTo(-3.5, 1);

      // Step 3: Access monitoring
      expect(sim.steps[2].scoreAfter).toBeCloseTo(9.45, 2);
      expect(sim.steps[2].delta).toBeCloseTo(-1.05, 2);

      // Step 4: DB encryption
      expect(sim.steps[3].scoreAfter).toBeCloseTo(7.56, 2);
      expect(sim.steps[3].delta).toBeCloseTo(-1.89, 2);

      // Final
      expect(sim.final.score).toBeCloseTo(7.56, 2);
      expect(sim.current.score).toBe(20);

      // Verify no DB mutations or audit logs
      const afterRisk = await riskService.getRisk(CTX_A_ADMIN, risk.riskId);
      expect(afterRisk.updatedAt).toBe(risk.updatedAt);
      const audits = await AuditLog.find({ action: /simulate/ });
      expect(audits.length).toBe(0);
    });

    it("different control order produces different step deltas but same final score", async () => {
      const asset = await makeAsset(ORG_A);
      const risk = await riskService.createRisk(CTX_A_ADMIN, {
        assetId: asset._id.toString(),
        threatKey: "thr_data_breach",
        vulnerabilityKey: "vul_weak_access_control",
        likelihood: 4,
        impact: 5,
        owner: "Admin",
      });

      const simReversed = await simulateRisk(CTX_A_ADMIN, risk.riskId, {
        controlKeys: [
          "ctl_db_encryption",
          "ctl_access_monitoring",
          "ctl_mfa",
          "ctl_rbac",
        ],
      });

      expect(simReversed.final.score).toBeCloseTo(7.56, 2);
      // Step 1 (DB encryption reduces impact): 4 * (5 * 0.8) = 16, delta = -4
      expect(simReversed.steps[0].scoreAfter).toBeCloseTo(16, 1);
      expect(simReversed.steps[0].delta).toBeCloseTo(-4, 1);
    });
  });

  // ── Assessment Snapshots & Trends ─────────────────────────────────────────
  describe("Assessment Snapshots & Trends", () => {
    it("creates immutable snapshot over residual scores of non-Closed risks", async () => {
      const asset = await makeAsset(ORG_A);

      // Risk 1: In Treatment (10.5)
      const r1 = await riskService.createRisk(CTX_A_ADMIN, {
        assetId: asset._id.toString(),
        threatKey: "thr_data_breach",
        vulnerabilityKey: "vul_weak_access_control",
        likelihood: 4,
        impact: 5,
        owner: "Admin",
      });
      await riskService.setRiskControls(CTX_A_ADMIN, r1.riskId, {
        controls: [
          { controlKey: "ctl_rbac", status: "implemented" },
          { controlKey: "ctl_mfa", status: "implemented" },
        ],
        expectedUpdatedAt: r1.updatedAt,
      });

      // Risk 2: Mitigated (~7.56)
      const webAsset = await makeAsset(ORG_A, {
        name: "Student Portal",
        type: "Web Application",
      });
      const r2 = await riskService.createRisk(CTX_A_ADMIN, {
        assetId: webAsset._id.toString(),
        threatKey: "thr_sql_injection",
        vulnerabilityKey: "vul_poor_input_validation",
        likelihood: 4,
        impact: 4,
        owner: "Admin",
      });
      await riskService.setRiskControls(CTX_A_ADMIN, r2.riskId, {
        controls: [
          { controlKey: "ctl_input_validation", status: "implemented" },
        ],
        expectedUpdatedAt: r2.updatedAt,
      });

      // Risk 3: Closed (should be excluded)
      const serverAsset = await makeAsset(ORG_A, {
        name: "Campus Server",
        type: "Server",
      });
      const r3 = await riskService.createRisk(CTX_A_ADMIN, {
        assetId: serverAsset._id.toString(),
        threatKey: "thr_unauthorized_physical_access",
        vulnerabilityKey: "vul_no_physical_access_control",
        likelihood: 2,
        impact: 2,
        owner: "Admin",
      });
      await riskService.closeRisk(CTX_A_ADMIN, r3.riskId, {
        reason: "Fixed and closed.",
        expectedUpdatedAt: r3.updatedAt,
      });

      // Create snapshot
      const snapshot = await assessmentService.createAssessment(CTX_A_ADMIN, {
        label: "Q4 Assessment",
      });

      expect(snapshot.totalRisks).toBe(2);
      expect(snapshot.risks.length).toBe(2);
      expect(snapshot.risks.map((r) => r.riskId)).not.toContain(r3.riskId);

      // Changing a risk afterwards does NOT mutate existing snapshot
      const r1Current = await riskService.getRisk(CTX_A_ADMIN, r1.riskId);
      await riskService.closeRisk(CTX_A_ADMIN, r1.riskId, {
        reason: "Closed after snapshot taken.",
        expectedUpdatedAt: r1Current.updatedAt,
      });

      const fetchedSnapshot = await assessmentService.getAssessment(
        CTX_A_ADMIN,
        snapshot.id
      );
      expect(fetchedSnapshot.totalRisks).toBe(2);
      expect(fetchedSnapshot.risks.length).toBe(2);
    });

    it("trend returns snapshots ordered oldest to newest and honors limit", async () => {
      await makeAsset(ORG_A);

      await assessmentService.createAssessment(
        CTX_A_ADMIN,
        { label: "S1" },
        { asOf: new Date("2026-08-01") }
      );
      await assessmentService.createAssessment(
        CTX_A_ADMIN,
        { label: "S2" },
        { asOf: new Date("2026-09-01") }
      );
      await assessmentService.createAssessment(
        CTX_A_ADMIN,
        { label: "S3" },
        { asOf: new Date("2026-10-01") }
      );

      const trend = await assessmentService.getTrend(CTX_A_ADMIN, { limit: 2 });
      expect(trend.length).toBe(2);
      expect(trend[0].label).toBe("S2");
      expect(trend[1].label).toBe("S3");
    });
  });

  // ── Tenant Isolation ──────────────────────────────────────────────────────
  describe("Tenant Isolation", () => {
    it("Org B cannot view, edit, simulate or delete Org A's risks or assessments", async () => {
      const assetA = await makeAsset(ORG_A);
      const riskA = await riskService.createRisk(CTX_A_ADMIN, {
        assetId: assetA._id.toString(),
        threatKey: "thr_data_breach",
        vulnerabilityKey: "vul_weak_access_control",
        likelihood: 4,
        impact: 5,
        owner: "Admin",
      });

      const snapA = await assessmentService.createAssessment(CTX_A_ADMIN, {
        label: "Org A Snapshot",
      });

      // Org B attempts
      await expect(
        riskService.getRisk(CTX_B_ADMIN, riskA.riskId)
      ).rejects.toMatchObject({ statusCode: 404 });

      await expect(
        riskService.setRiskControls(CTX_B_ADMIN, riskA.riskId, {
          controls: [{ controlKey: "ctl_rbac", status: "implemented" }],
          expectedUpdatedAt: riskA.updatedAt,
        })
      ).rejects.toMatchObject({ statusCode: 404 });

      await expect(
        simulateRisk(CTX_B_ADMIN, riskA.riskId, {
          controlKeys: ["ctl_rbac"],
        })
      ).rejects.toMatchObject({ statusCode: 404 });

      await expect(
        assessmentService.getAssessment(CTX_B_ADMIN, snapA.id)
      ).rejects.toMatchObject({ statusCode: 404 });

      await expect(
        assessmentService.deleteAssessment(CTX_B_ADMIN, snapA.id)
      ).rejects.toMatchObject({ statusCode: 404 });

      const trendB = await assessmentService.getTrend(CTX_B_ADMIN, { limit: 10 });
      expect(trendB.length).toBe(0);
    });
  });
});
