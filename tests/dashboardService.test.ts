import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { runSeed } from "@/scripts/seed";
import { Asset } from "@/models/Asset";
import { Risk } from "@/models/Risk";
import { Assessment } from "@/models/Assessment";
import { AuditLog } from "@/models/AuditLog";
import { Counter } from "@/models/Counter";
import { dashboardService } from "@/services/dashboardService";
import { assetRiskService } from "@/services/assetRiskService";
import { riskService } from "@/services/riskService";
import { matrixService } from "@/services/matrixService";
import { assessmentService } from "@/services/assessmentService";
import {
  summarize,
  overallLevel,
  level,
  levelRange,
  criticality,
} from "@/lib/riskEngine";
import { AppError } from "@/lib/errors";

let mongoServer: MongoMemoryServer;

const ORG_A = "org_default";
const CTX_A = { organizationId: ORG_A, actorId: "admin_a" };
const ORG_B = "org_tenant_b";
const CTX_B = { organizationId: ORG_B, actorId: "admin_b" };

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
  await runSeed(CTX_A);
});

describe("Dashboard & Asset Risk Services", () => {
  // ── 1. Independent Recomputations ───────────────────────────────────────────
  describe("Independent Recomputations against lib/riskEngine", () => {
    it("matches independently computed scores, levels, counts, and top risks", async () => {
      const dbRisks = await Risk.find({ organizationId: ORG_A, status: { $ne: "Closed" } }).lean();
      const residualScores = dbRisks.map((r) => r.residualScore);
      const inherentScores = dbRisks.map((r) => r.inherentScore);

      const expectedResSummary = summarize(residualScores);
      const expectedInhSummary = summarize(inherentScores);

      const dto = await dashboardService.getDashboard(CTX_A, { basis: "residual", trendLimit: 12 });

      // Overall scores & levels
      expect(dto.overall.score).toBe(expectedResSummary.overall);
      expect(dto.overall.level).toBe(overallLevel(expectedResSummary.overall));
      expect(dto.overall.max).toBe(expectedResSummary.max);
      expect(dto.overall.maxLevel).toBe(level(expectedResSummary.max));
      expect(dto.overall.counts).toEqual(expectedResSummary.counts);

      expect(dto.residualOverall.score).toBe(expectedResSummary.overall);
      expect(dto.inherentOverall.score).toBe(expectedInhSummary.overall);

      // Distribution
      expect(dto.distribution).toEqual([
        { level: "Low", count: expectedResSummary.counts.Low },
        { level: "Medium", count: expectedResSummary.counts.Medium },
        { level: "High", count: expectedResSummary.counts.High },
        { level: "Critical", count: expectedResSummary.counts.Critical },
      ]);

      // Category breakdown sum matches total included risks
      const categorySum = dto.byCategory.reduce((acc, c) => acc + c.total, 0);
      expect(categorySum).toBe(dto.totals.includedRisks);

      // Top 10 risks order matches independent sort
      const sortedDbRisks = [...dbRisks].sort((a, b) => {
        const diff = b.residualScore - a.residualScore;
        if (diff !== 0) return diff;
        return a.riskId.localeCompare(b.riskId);
      });
      const expectedTop10Ids = sortedDbRisks.slice(0, 10).map((r) => r.riskId);
      const actualTop10Ids = dto.topRisks.map((r) => r.riskId);
      expect(actualTop10Ids).toEqual(expectedTop10Ids);
    });

    it("basis inherent toggles overall, distribution, and top risks without modifying control or vs charts", async () => {
      const resDto = await dashboardService.getDashboard(CTX_A, { basis: "residual", trendLimit: 12 });
      const inhDto = await dashboardService.getDashboard(CTX_A, { basis: "inherent", trendLimit: 12 });

      const dbRisks = await Risk.find({ organizationId: ORG_A, status: { $ne: "Closed" } }).lean();
      const inherentScores = dbRisks.map((r) => r.inherentScore);
      const expectedInhSummary = summarize(inherentScores);

      expect(inhDto.overall.score).toBe(expectedInhSummary.overall);
      expect(inhDto.overall.counts).toEqual(expectedInhSummary.counts);
      expect(inhDto.topRisks[0].score).toBe(inhDto.topRisks[0].inherentScore);

      // Charts that must remain unchanged
      expect(inhDto.inherentVsResidual).toEqual(resDto.inherentVsResidual);
      expect(inhDto.controlImplementation).toEqual(resDto.controlImplementation);
    });
  });

  // ── 2. Cross-Checks Between Modules ─────────────────────────────────────────
  describe("Cross-Checks with Risk Register, Matrix, and Assessment Snapshots", () => {
    it("dashboard includedRisks equals sum of active risks in register and matrix total", async () => {
      const dto = await dashboardService.getDashboard(CTX_A, { basis: "residual", trendLimit: 12 });

      const defaultListQuery = {
        basis: "residual" as const,
        sort: "riskId",
        order: "asc" as const,
        page: 1,
        limit: 100,
      };

      const [rOpen, rInTreatment, rMitigated, rAccepted] = await Promise.all([
        riskService.listRisks(CTX_A, { ...defaultListQuery, status: "Open" }),
        riskService.listRisks(CTX_A, { ...defaultListQuery, status: "In Treatment" }),
        riskService.listRisks(CTX_A, { ...defaultListQuery, status: "Mitigated" }),
        riskService.listRisks(CTX_A, { ...defaultListQuery, status: "Accepted" }),
      ]);
      const registerActiveCount =
        rOpen.total + rInTreatment.total + rMitigated.total + rAccepted.total;
      expect(dto.totals.includedRisks).toBe(registerActiveCount);

      const matrix = await matrixService.getMatrix(CTX_A, { basis: "residual", includeClosed: false });
      expect(dto.totals.includedRisks).toBe(matrix.totalPlotted + matrix.notPlotted);
    });

    it("dashboard residual counts match a fresh snapshot created at the same moment", async () => {
      const dto = await dashboardService.getDashboard(CTX_A, { basis: "residual", trendLimit: 12 });
      const snap = await assessmentService.createAssessment(CTX_A, { label: "Verification Snap" });

      expect(dto.overall.counts).toEqual(snap.counts);
      expect(dto.overall.score).toBe(snap.overallScore);
    });

    it("closing or avoiding a risk removes it from includedRisks and aggregations", async () => {
      const beforeDto = await dashboardService.getDashboard(CTX_A, { basis: "residual", trendLimit: 12 });

      // Close a risk
      const activeRisk = await Risk.findOne({ organizationId: ORG_A, status: "Open" });
      expect(activeRisk).not.toBeNull();

      await riskService.closeRisk(CTX_A, activeRisk!.riskId, {
        reason: "Decommissioned",
        expectedUpdatedAt: activeRisk!.updatedAt.toISOString(),
      });

      const afterDto = await dashboardService.getDashboard(CTX_A, { basis: "residual", trendLimit: 12 });
      expect(afterDto.totals.includedRisks).toBe(beforeDto.totals.includedRisks - 1);
      expect(afterDto.totals.closedRisks).toBe(beforeDto.totals.closedRisks + 1);
    });
  });

  // ── 3. Projection ───────────────────────────────────────────────────────────
  describe("Projected Overall Score", () => {
    it("seeded projected score is <= residual overall, and counts only planned controls", async () => {
      const dto = await dashboardService.getDashboard(CTX_A, { basis: "residual", trendLimit: 12 });
      expect(dto.projected.score).toBeLessThanOrEqual(dto.residualOverall.score);
      expect(dto.projected.delta).toBe(dto.projected.score - dto.residualOverall.score);
      expect(dto.projected.risksAffected).toBeGreaterThan(0);
    });

    it("hand-built case: planned controls reduce projected risk without altering stored residual", async () => {
      // Clear risks to isolate a hand-built test case
      await Risk.deleteMany({ organizationId: ORG_A });

      const asset = await Asset.findOne({ organizationId: ORG_A });
      expect(asset).not.toBeNull();

      const risk = await Risk.create({
        organizationId: ORG_A,
        riskId: "R999",
        assetId: asset!._id,
        threatId: "thr_ransomware",
        vulnerabilityId: "vul_unpatched_software",
        likelihood: 5,
        impact: 5,
        suggestedImpact: 5,
        impactOverridden: false,
        inherentScore: 25,
        inherentLevel: "Critical",
        residualLikelihood: 5,
        residualImpact: 3.5,
        residualScore: 17.5,
        residualLevel: "Critical",
        treatment: "mitigate",
        controls: [
          { controlId: "ctl_offline_backup", status: "implemented" },
          { controlId: "ctl_edr", status: "planned" },
        ],
        status: "Open",
        owner: "Admin",
        notes: "",
      });

      const dto = await dashboardService.getDashboard(CTX_A, { basis: "residual", trendLimit: 12 });
      expect(dto.projected.risksAffected).toBe(1);
      expect(dto.projected.score).toBeLessThan(dto.residualOverall.score);

      // Verify stored risk was not touched
      const reloaded = await Risk.findById(risk._id).lean();
      expect(reloaded?.residualScore).toBe(17.5);
    });
  });

  // ── 4. Dynamic Bands ────────────────────────────────────────────────────────
  describe("Dynamic Bands", () => {
    it("bands.risk matches levelRange for all four levels", async () => {
      const dto = await dashboardService.getDashboard(CTX_A, { basis: "residual", trendLimit: 12 });
      expect(dto.bands.risk).toEqual([
        { level: "Low", ...levelRange("Low") },
        { level: "Medium", ...levelRange("Medium") },
        { level: "High", ...levelRange("High") },
        { level: "Critical", ...levelRange("Critical") },
      ]);
    });

    it("bands.overall is contiguous, starts at 0, ends at null, and matches overallLevel", async () => {
      const dto = await dashboardService.getDashboard(CTX_A, { basis: "residual", trendLimit: 12 });
      const overallBands = dto.bands.overall;

      expect(overallBands[0].from).toBe(0);
      expect(overallBands[overallBands.length - 1].to).toBeNull();

      for (let i = 0; i < overallBands.length; i++) {
        const band = overallBands[i];
        expect(overallLevel(band.from)).toBe(band.level);
        if (i < overallBands.length - 1) {
          expect(band.to).toBe(overallBands[i + 1].from);
        }
      }
    });
  });

  // ── 5. Snapshot Comparison & Trend ──────────────────────────────────────────
  describe("Snapshot Comparison & Historical Trend", () => {
    it("compares against latest snapshot with correct delta", async () => {
      const dto = await dashboardService.getDashboard(CTX_A, { basis: "residual", trendLimit: 12 });
      expect(dto.snapshotComparison).not.toBeNull();
      expect(dto.snapshotComparison?.label).toBe("Current state");
      expect(dto.snapshotComparison?.delta).toBe(
        dto.residualOverall.score - dto.snapshotComparison!.score
      );
    });

    it("honors trendLimit and preserves chronological order (oldest to newest)", async () => {
      const dto = await dashboardService.getDashboard(CTX_A, { basis: "residual", trendLimit: 2 });
      expect(dto.trend.length).toBeLessThanOrEqual(2);
      if (dto.trend.length === 2) {
        expect(new Date(dto.trend[0].date).getTime()).toBeLessThanOrEqual(
          new Date(dto.trend[1].date).getTime()
        );
      }
    });
  });

  // ── 6. Asset Risk View ──────────────────────────────────────────────────────
  describe("Asset Risk Service (services/assetRiskService.ts)", () => {
    it("Student Database row shows pinned risk, level = level(maxScore), and exact criticality", async () => {
      const res = await assetRiskService.listAssetRisk(CTX_A, {
        basis: "residual",
        sort: "maxScore",
        order: "desc",
        includeUnassessed: true,
        page: 1,
        limit: 20,
      });

      const sdb = res.items.find((item) => item.name === "Student Database");
      expect(sdb).toBeDefined();
      expect(sdb?.riskCount).toBeGreaterThan(0);
      expect(sdb?.level).toBe(level(sdb!.maxScore));
      expect(sdb?.criticality).toBeCloseTo(criticality(5, 5, 4), 3);
    });

    it("unassessed assets have level: null, riskCount: 0, and sort last under maxScore", async () => {
      // Create an asset with zero risks
      const emptyAsset = await Asset.create({
        organizationId: ORG_A,
        name: "Empty Backup Drive",
        type: "Physical Equipment",
        confidentiality: 1,
        integrity: 1,
        availability: 1,
        owner: "Archivist",
      });

      const resDesc = await assetRiskService.listAssetRisk(CTX_A, {
        basis: "residual",
        sort: "maxScore",
        order: "desc",
        includeUnassessed: true,
        page: 1,
        limit: 50,
      });

      const resAsc = await assetRiskService.listAssetRisk(CTX_A, {
        basis: "residual",
        sort: "maxScore",
        order: "asc",
        includeUnassessed: true,
        page: 1,
        limit: 50,
      });

      const descItem = resDesc.items.find((i) => i.assetId === emptyAsset._id.toString());
      expect(descItem?.level).toBeNull();
      expect(descItem?.riskCount).toBe(0);

      // Unassessed assets sort last in both asc and desc for maxScore
      const lastDesc = resDesc.items[resDesc.items.length - 1];
      const lastAsc = resAsc.items[resAsc.items.length - 1];
      expect(lastDesc.riskCount).toBe(0);
      expect(lastAsc.riskCount).toBe(0);

      // includeUnassessed=false hides them
      const hidden = await assetRiskService.listAssetRisk(CTX_A, {
        basis: "residual",
        sort: "maxScore",
        order: "desc",
        includeUnassessed: false,
        page: 1,
        limit: 50,
      });
      expect(hidden.items.some((i) => i.assetId === emptyAsset._id.toString())).toBe(false);
    });

    it("escapes regex search characters . and ( literally", async () => {
      await Asset.create({
        organizationId: ORG_A,
        name: "Legacy (v1.0) Server",
        type: "Server",
        confidentiality: 3,
        integrity: 3,
        availability: 3,
        owner: "Ops",
      });

      const res = await assetRiskService.listAssetRisk(CTX_A, {
        basis: "residual",
        q: "(v1.0)",
        sort: "name",
        order: "asc",
        includeUnassessed: true,
        page: 1,
        limit: 10,
      });
      expect(res.items).toHaveLength(1);
      expect(res.items[0].name).toBe("Legacy (v1.0) Server");
    });

    it("getAssetRisk detail returns individual risks and throws 404 for unknown asset", async () => {
      const asset = await Asset.findOne({ organizationId: ORG_A, name: "Student Database" });
      expect(asset).not.toBeNull();

      const detail = await assetRiskService.getAssetRisk(CTX_A, asset!._id.toString(), {
        basis: "residual",
        includeClosed: false,
      });
      expect(detail.name).toBe("Student Database");
      expect(detail.risks.length).toBeGreaterThan(0);

      await expect(
        assetRiskService.getAssetRisk(CTX_A, new mongoose.Types.ObjectId().toString(), {
          basis: "residual",
          includeClosed: false,
        })
      ).rejects.toThrow(AppError);
    });
  });

  // ── 7. Tenant Isolation & Empty State ───────────────────────────────────────
  describe("Tenant Isolation & Edge Cases", () => {
    it("empty organization returns valid zeroed DTO without crashing", async () => {
      const dto = await dashboardService.getDashboard(CTX_B, { basis: "residual", trendLimit: 12 });
      expect(dto.totals.assets).toBe(0);
      expect(dto.totals.includedRisks).toBe(0);
      expect(dto.overall.score).toBe(0);
      expect(dto.overall.level).toBe("Low");
      expect(dto.topRisks).toEqual([]);
      expect(dto.vulnerableAssets).toEqual([]);
      expect(dto.snapshotComparison).toBeNull();
    });

    it("organization B cannot access organization A assets or risks", async () => {
      const assetA = await Asset.findOne({ organizationId: ORG_A });
      expect(assetA).not.toBeNull();

      // Org B querying Org A asset returns 404
      await expect(
        assetRiskService.getAssetRisk(CTX_B, assetA!._id.toString(), {
          basis: "residual",
          includeClosed: false,
        })
      ).rejects.toThrow("Asset not found");
    });
  });

  // ── 8. Query Boundedness Performance Guard ──────────────────────────────────
  describe("Performance & Query Boundedness", () => {
    it("scales with bounded queries and completes under 2 seconds for 500 risks", async () => {
      const asset = await Asset.findOne({ organizationId: ORG_A });
      expect(asset).not.toBeNull();

      const bulkRisks = Array.from({ length: 500 }, (_, i) => ({
        organizationId: ORG_A,
        riskId: `R${1000 + i}`,
        assetId: asset!._id,
        threatId: "thr_ransomware",
        vulnerabilityId: "vul_unpatched_software",
        likelihood: (i % 5) + 1,
        impact: (i % 5) + 1,
        suggestedImpact: 3,
        impactOverridden: false,
        inherentScore: ((i % 5) + 1) * ((i % 5) + 1),
        inherentLevel: "Medium",
        residualLikelihood: 2,
        residualImpact: 2,
        residualScore: 4,
        residualLevel: "Low",
        treatment: "mitigate",
        controls: [{ controlId: "ctl_mfa", status: "implemented" }],
        status: "Open",
        owner: "Admin",
        notes: "",
      }));

      await Risk.insertMany(bulkRisks);

      const start = Date.now();
      const dto = await dashboardService.getDashboard(CTX_A, { basis: "residual", trendLimit: 12 });
      const duration = Date.now() - start;

      expect(dto.totals.includedRisks).toBeGreaterThanOrEqual(500);
      expect(duration).toBeLessThan(2000); // completes in < 2 seconds
    });
  });
});
