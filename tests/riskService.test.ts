import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { runSeed } from "@/scripts/seed";
import { Asset } from "@/models/Asset";
import { Risk } from "@/models/Risk";
import { AuditLog } from "@/models/AuditLog";
import { Counter } from "@/models/Counter";
import { riskService } from "@/services/riskService";
import { matrixService } from "@/services/matrixService";
import { level } from "@/lib/riskEngine";

let mongoServer: MongoMemoryServer;

// ── Shared test asset ────────────────────────────────────────────────────────
// Student Database — C5/I5/A4 (matches spec worked example)
async function makeAsset(orgId: string, overrides?: Partial<{
  name: string; type: string; confidentiality: number; integrity: number; availability: number; owner: string;
}>) {
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

const ORG_A = "orgA_risk_test";
const ORG_B = "orgB_risk_test";
const ACTOR_A = "actor_a";
const CTX_A = { organizationId: ORG_A, actorId: ACTOR_A };
const CTX_B = { organizationId: ORG_B, actorId: "actor_b" };

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  // Clear risk-specific collections; keep library seed
  await Risk.deleteMany({});
  await Asset.deleteMany({});
  await AuditLog.deleteMany({});
  await Counter.deleteMany({});
  await runSeed();
});

// ── Creation tests ────────────────────────────────────────────────────────────
describe("riskService.createRisk", () => {
  it("creates the pinned risk: R001, inherentScore 20, Critical, mitigate, Open, no controls", async () => {
    const asset = await makeAsset(ORG_A);
    const risk = await riskService.createRisk(CTX_A, {
      assetId: asset._id.toString(),
      threatKey: "thr_data_breach",
      vulnerabilityKey: "vul_weak_access_control",
      likelihood: 4,
      impact: 5,
      owner: "Admin",
    });

    expect(risk.riskId).toBe("R001");
    expect(risk.suggestedImpact).toBe(5);      // C=5, threat ciaTarget=C
    expect(risk.impactOverridden).toBe(false);
    expect(risk.inherentScore).toBe(20);
    expect(risk.inherentLevel).toBe("Critical");
    expect(risk.residualScore).toBe(20);       // no controls -> residual = inherent
    expect(risk.treatment).toBe("mitigate");
    expect(risk.status).toBe("Open");
    expect(risk.controlsTotal).toBe(0);
  });

  it("impact override: impact 3 -> impactOverridden true, audit after shows suggestedImpact 5", async () => {
    const asset = await makeAsset(ORG_A);
    const risk = await riskService.createRisk(CTX_A, {
      assetId: asset._id.toString(),
      threatKey: "thr_data_breach",
      vulnerabilityKey: "vul_weak_access_control",
      likelihood: 4,
      impact: 3,
      owner: "Admin",
    });

    expect(risk.impactOverridden).toBe(true);
    expect(risk.suggestedImpact).toBe(5);
    expect(risk.inherentScore).toBe(12);  // 4*3

    const auditEntry = await AuditLog.findOne({ entityId: risk.id, action: "risk.create" }).lean();
    expect(auditEntry).not.toBeNull();
    expect((auditEntry!.changes!.after as { suggestedImpact: number }).suggestedImpact).toBe(5);
    expect(auditEntry!.actor).toBe(ACTOR_A);
    expect(auditEntry!.organizationId).toBe(ORG_A);
  });

  it("sequence: three creations yield R001, R002, R003; two orgs count independently", async () => {
    const assetA = await makeAsset(ORG_A, { name: "Asset A1" });
    const assetA2 = await makeAsset(ORG_A, { name: "Asset A2" });
    const assetA3 = await makeAsset(ORG_A, { name: "Asset A3" });
    const assetB = await makeAsset(ORG_B, { name: "Asset B1" });

    const r1 = await riskService.createRisk(CTX_A, { assetId: assetA._id.toString(), threatKey: "thr_data_breach", vulnerabilityKey: "vul_weak_access_control", likelihood: 1, impact: 1, owner: "o" });
    const r2 = await riskService.createRisk(CTX_A, { assetId: assetA2._id.toString(), threatKey: "thr_data_breach", vulnerabilityKey: "vul_weak_access_control", likelihood: 1, impact: 1, owner: "o" });
    const r3 = await riskService.createRisk(CTX_A, { assetId: assetA3._id.toString(), threatKey: "thr_data_breach", vulnerabilityKey: "vul_weak_access_control", likelihood: 1, impact: 1, owner: "o" });
    const rb1 = await riskService.createRisk(CTX_B, { assetId: assetB._id.toString(), threatKey: "thr_data_breach", vulnerabilityKey: "vul_weak_access_control", likelihood: 1, impact: 1, owner: "o" });

    expect(r1.riskId).toBe("R001");
    expect(r2.riskId).toBe("R002");
    expect(r3.riskId).toBe("R003");
    expect(rb1.riskId).toBe("R001"); // org B has its own counter
  });

  it("400 when threat not applicable to asset type", async () => {
    // thr_data_breach is applicable to Database; let's use a Server asset (check seeds)
    const asset = await makeAsset(ORG_A, { type: "Server", name: "My Server" });
    await expect(
      riskService.createRisk(CTX_A, {
        assetId: asset._id.toString(),
        threatKey: "thr_data_breach",
        vulnerabilityKey: "vul_weak_access_control",
        likelihood: 1, impact: 1, owner: "o",
      })
    ).rejects.toMatchObject({ statusCode: 400, message: "THREAT_NOT_APPLICABLE" });
  });

  it("400 when vulnerability not linked to the threat", async () => {
    const asset = await makeAsset(ORG_A);
    // vul_unpatched_software is not linked to thr_data_breach
    await expect(
      riskService.createRisk(CTX_A, {
        assetId: asset._id.toString(),
        threatKey: "thr_data_breach",
        vulnerabilityKey: "vul_unpatched_software",
        likelihood: 1, impact: 1, owner: "o",
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("404 for asset belonging to another org", async () => {
    const assetB = await makeAsset(ORG_B, { name: "OrgB Asset" });
    await expect(
      riskService.createRisk(CTX_A, {
        assetId: assetB._id.toString(),
        threatKey: "thr_data_breach",
        vulnerabilityKey: "vul_weak_access_control",
        likelihood: 1, impact: 1, owner: "o",
      })
    ).rejects.toMatchObject({ statusCode: 404, message: "Asset not found" });
  });

  it("409 duplicate combination; allowed once Closed; allowed in different org", async () => {
    const asset = await makeAsset(ORG_A);
    const r1 = await riskService.createRisk(CTX_A, { assetId: asset._id.toString(), threatKey: "thr_data_breach", vulnerabilityKey: "vul_weak_access_control", likelihood: 1, impact: 1, owner: "o" });

    await expect(
      riskService.createRisk(CTX_A, { assetId: asset._id.toString(), threatKey: "thr_data_breach", vulnerabilityKey: "vul_weak_access_control", likelihood: 2, impact: 2, owner: "o" })
    ).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining(r1.riskId) });

    // Close the risk directly in DB
    await Risk.updateOne({ riskId: r1.riskId, organizationId: ORG_A }, { $set: { status: "Closed" } });

    // Now allowed again
    const r2 = await riskService.createRisk(CTX_A, { assetId: asset._id.toString(), threatKey: "thr_data_breach", vulnerabilityKey: "vul_weak_access_control", likelihood: 2, impact: 2, owner: "o" });
    expect(r2.riskId).toBe("R002");

    // Allowed in org B
    const assetB = await makeAsset(ORG_B, { name: "DB Asset B" });
    const rb = await riskService.createRisk(CTX_B, { assetId: assetB._id.toString(), threatKey: "thr_data_breach", vulnerabilityKey: "vul_weak_access_control", likelihood: 1, impact: 1, owner: "o" });
    expect(rb.riskId).toBe("R001");
  });
});

// ── Update tests ──────────────────────────────────────────────────────────────
describe("riskService.updateRisk", () => {
  it("changing likelihood recomputes inherent and residual", async () => {
    const asset = await makeAsset(ORG_A);
    const created = await riskService.createRisk(CTX_A, { assetId: asset._id.toString(), threatKey: "thr_data_breach", vulnerabilityKey: "vul_weak_access_control", likelihood: 4, impact: 5, owner: "o" });

    const updated = await riskService.updateRisk(CTX_A, created.riskId, {
      likelihood: 2,
      impact: 5,
      owner: "o",
      notes: "",
      expectedUpdatedAt: created.updatedAt,
    });

    expect(updated.inherentScore).toBe(10); // 2*5
    expect(updated.inherentLevel).toBe("High");
    expect(updated.residualScore).toBe(10); // no controls
  });

  it("changing asset CIA recomputes suggestedImpact and impactOverridden on next update", async () => {
    const asset = await makeAsset(ORG_A); // C=5 -> suggestedImpact=5
    const created = await riskService.createRisk(CTX_A, { assetId: asset._id.toString(), threatKey: "thr_data_breach", vulnerabilityKey: "vul_weak_access_control", likelihood: 4, impact: 5, owner: "o" });
    expect(created.impactOverridden).toBe(false);

    // Change the asset's confidentiality to 3
    await Asset.updateOne({ _id: asset._id }, { $set: { confidentiality: 3 } });

    const updated = await riskService.updateRisk(CTX_A, created.riskId, {
      likelihood: 4, impact: 5, owner: "o", notes: "",
      expectedUpdatedAt: created.updatedAt,
    });

    expect(updated.suggestedImpact).toBe(3);   // C now = 3
    expect(updated.impactOverridden).toBe(true); // impact=5 != suggestedImpact=3
  });

  it("pinned risk with 4 controls: L=4,I=5 -> residual ~7.56; L=3 -> residual ~5.67", async () => {
    const asset = await makeAsset(ORG_A);
    const created = await riskService.createRisk(CTX_A, { assetId: asset._id.toString(), threatKey: "thr_data_breach", vulnerabilityKey: "vul_weak_access_control", likelihood: 4, impact: 5, owner: "o" });

    // Insert the 4 pinned controls directly into the risk
    await Risk.updateOne({ riskId: created.riskId, organizationId: ORG_A }, {
      $set: {
        controls: [
          { controlId: "ctl_rbac", status: "implemented" },
          { controlId: "ctl_mfa", status: "implemented" },
          { controlId: "ctl_access_monitoring", status: "implemented" },
          { controlId: "ctl_db_encryption", status: "implemented" },
        ],
      },
    });

    // Re-fetch to get current updatedAt
    const fetched = await riskService.getRisk(CTX_A, created.riskId);

    // Now update with L=4 (same) to trigger score recomputation
    const withControls = await riskService.updateRisk(CTX_A, created.riskId, {
      likelihood: 4, impact: 5, owner: "o", notes: "",
      expectedUpdatedAt: fetched.updatedAt,
    });
    expect(withControls.residualScore).toBeCloseTo(7.56, 1);

    // Change L to 3
    const withL3 = await riskService.updateRisk(CTX_A, created.riskId, {
      likelihood: 3, impact: 5, owner: "o", notes: "",
      expectedUpdatedAt: withControls.updatedAt,
    });
    // 3 * 0.7 * 0.75 * 0.9 = 1.4175; I = 5*0.8 = 4.0; score = 1.4175 * 4.0 = 5.67
    expect(withL3.residualScore).toBeCloseTo(5.67, 1);
  });

  it("stale expectedUpdatedAt -> 409 and risk unchanged", async () => {
    const asset = await makeAsset(ORG_A);
    const created = await riskService.createRisk(CTX_A, { assetId: asset._id.toString(), threatKey: "thr_data_breach", vulnerabilityKey: "vul_weak_access_control", likelihood: 4, impact: 5, owner: "o" });

    await expect(
      riskService.updateRisk(CTX_A, created.riskId, {
        likelihood: 3, impact: 5, owner: "o", notes: "",
        expectedUpdatedAt: "2000-01-01T00:00:00.000Z", // definitely stale
      })
    ).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining("someone else") });

    const unchanged = await riskService.getRisk(CTX_A, created.riskId);
    expect(unchanged.likelihood).toBe(4); // unchanged
  });

  it("two concurrent updates with same token: exactly one succeeds", async () => {
    const asset = await makeAsset(ORG_A);
    const created = await riskService.createRisk(CTX_A, { assetId: asset._id.toString(), threatKey: "thr_data_breach", vulnerabilityKey: "vul_weak_access_control", likelihood: 4, impact: 5, owner: "o" });

    const token = created.updatedAt;
    const [result1, result2] = await Promise.allSettled([
      riskService.updateRisk(CTX_A, created.riskId, { likelihood: 2, impact: 5, owner: "o", notes: "first", expectedUpdatedAt: token }),
      riskService.updateRisk(CTX_A, created.riskId, { likelihood: 3, impact: 5, owner: "o", notes: "second", expectedUpdatedAt: token }),
    ]);

    const successes = [result1, result2].filter(r => r.status === "fulfilled");
    const failures = [result1, result2].filter(r => r.status === "rejected");
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
  });

  it("audit risk.update has before and after", async () => {
    const asset = await makeAsset(ORG_A);
    const created = await riskService.createRisk(CTX_A, { assetId: asset._id.toString(), threatKey: "thr_data_breach", vulnerabilityKey: "vul_weak_access_control", likelihood: 4, impact: 5, owner: "o" });

    await riskService.updateRisk(CTX_A, created.riskId, { likelihood: 2, impact: 5, owner: "Alice", notes: "", expectedUpdatedAt: created.updatedAt });

    const entry = await AuditLog.findOne({ entityId: created.id, action: "risk.update" }).lean();
    expect(entry).not.toBeNull();
    expect((entry!.changes!.before as { likelihood: number }).likelihood).toBe(4);
    expect((entry!.changes!.after as { likelihood: number }).likelihood).toBe(2);
  });
});

// ── List / search / summary ───────────────────────────────────────────────────
describe("riskService.listRisks", () => {
  async function seedRisks() {
    const asset1 = await makeAsset(ORG_A, { name: "Student Database", confidentiality: 5, integrity: 5, availability: 4 });
    const asset2 = await makeAsset(ORG_A, { name: "Web Portal", type: "Web Application", confidentiality: 3, integrity: 3, availability: 3 });

    // Patch risks to have specific known scores for level filter tests
    const r1 = await riskService.createRisk(CTX_A, { assetId: asset1._id.toString(), threatKey: "thr_data_breach", vulnerabilityKey: "vul_weak_access_control", likelihood: 4, impact: 5, owner: "Alice" });
    // score 20 = Critical
    const r2 = await riskService.createRisk(CTX_A, { assetId: asset2._id.toString(), threatKey: "thr_sql_injection", vulnerabilityKey: "vul_poor_input_validation", likelihood: 2, impact: 4, owner: "Bob" });
    // score 8 = Medium (2*4)
    return { r1, r2, asset1, asset2 };
  }

  it("search '.' and '(' do not throw", async () => {
    await seedRisks();
    const result1 = await riskService.listRisks(CTX_A, { basis: "residual", sort: "riskId", order: "asc", page: 1, limit: 20, q: "." });
    expect(Array.isArray(result1.items)).toBe(true);
    const result2 = await riskService.listRisks(CTX_A, { basis: "residual", sort: "riskId", order: "asc", page: 1, limit: 20, q: "(" });
    expect(Array.isArray(result2.items)).toBe(true);
  });

  it("q finds by riskId and owner and asset name", async () => {
    const { r1 } = await seedRisks();

    const byRiskId = await riskService.listRisks(CTX_A, { basis: "residual", sort: "riskId", order: "asc", page: 1, limit: 20, q: r1.riskId });
    expect(byRiskId.items.some(r => r.riskId === r1.riskId)).toBe(true);

    const byOwner = await riskService.listRisks(CTX_A, { basis: "residual", sort: "riskId", order: "asc", page: 1, limit: 20, q: "Alice" });
    expect(byOwner.items.some(r => r.owner === "Alice")).toBe(true);

    const byAssetName = await riskService.listRisks(CTX_A, { basis: "residual", sort: "riskId", order: "asc", page: 1, limit: 20, q: "Student" });
    expect(byAssetName.items.some(r => r.asset.name.includes("Student"))).toBe(true);
  });

  it("level filter uses levelRange correctly for inherent basis", async () => {
    await seedRisks();
    // r1: inherentScore=20 -> Critical; r2: inherentScore=8 -> Medium
    const critical = await riskService.listRisks(CTX_A, { basis: "inherent", sort: "riskId", order: "asc", page: 1, limit: 20, level: "Critical" });
    expect(critical.items.every(r => level(r.inherentScore) === "Critical")).toBe(true);
    expect(critical.items.length).toBeGreaterThan(0);

    const medium = await riskService.listRisks(CTX_A, { basis: "inherent", sort: "riskId", order: "asc", page: 1, limit: 20, level: "Medium" });
    expect(medium.items.every(r => level(r.inherentScore) === "Medium")).toBe(true);
  });

  it("summary counts match summarize() over all matching scores", async () => {
    await seedRisks();
    const result = await riskService.listRisks(CTX_A, { basis: "residual", sort: "riskId", order: "asc", page: 1, limit: 1 });
    // summary covers ALL 2 risks, not just the 1-item page
    expect(result.summary.total).toBe(2);
  });

  it("pagination returns correct total and items", async () => {
    await seedRisks();
    const page1 = await riskService.listRisks(CTX_A, { basis: "residual", sort: "riskId", order: "asc", page: 1, limit: 1 });
    expect(page1.total).toBe(2);
    expect(page1.items).toHaveLength(1);

    const page2 = await riskService.listRisks(CTX_A, { basis: "residual", sort: "riskId", order: "asc", page: 2, limit: 1 });
    expect(page2.items).toHaveLength(1);
    expect(page2.items[0].riskId).not.toBe(page1.items[0].riskId);
  });
});

// ── Matrix tests ──────────────────────────────────────────────────────────────
describe("matrixService.getMatrix", () => {
  it("always returns 25 cells", async () => {
    const result = await matrixService.getMatrix({ organizationId: ORG_A }, { basis: "residual", includeClosed: false });
    expect(result.cells).toHaveLength(25);
  });

  it("every cell.level === level(l*i)", async () => {
    const result = await matrixService.getMatrix({ organizationId: ORG_A }, { basis: "inherent", includeClosed: false });
    for (const cell of result.cells) {
      expect(cell.level).toBe(level(cell.likelihood * cell.impact));
    }
  });

  it("a risk at L4/I5 appears in the (4,5) cell", async () => {
    const asset = await makeAsset(ORG_A);
    await riskService.createRisk(CTX_A, { assetId: asset._id.toString(), threatKey: "thr_data_breach", vulnerabilityKey: "vul_weak_access_control", likelihood: 4, impact: 5, owner: "o" });

    const result = await matrixService.getMatrix({ organizationId: ORG_A }, { basis: "inherent", includeClosed: false });
    const cell = result.cells.find(c => c.likelihood === 4 && c.impact === 5)!;
    expect(cell.count).toBe(1);
    expect(cell.risks[0].riskId).toBe("R001");
  });

  it("counts sum to totalPlotted", async () => {
    const asset = await makeAsset(ORG_A);
    await riskService.createRisk(CTX_A, { assetId: asset._id.toString(), threatKey: "thr_data_breach", vulnerabilityKey: "vul_weak_access_control", likelihood: 4, impact: 5, owner: "o" });

    const result = await matrixService.getMatrix({ organizationId: ORG_A }, { basis: "inherent", includeClosed: false });
    const total = result.cells.reduce((sum, c) => sum + c.count, 0);
    expect(total).toBe(result.totalPlotted);
  });

  it("residual basis rounds positions (e.g. 1.89/4.0 -> cell 2,4)", async () => {
    const asset = await makeAsset(ORG_A);
    const created = await riskService.createRisk(CTX_A, { assetId: asset._id.toString(), threatKey: "thr_data_breach", vulnerabilityKey: "vul_weak_access_control", likelihood: 4, impact: 5, owner: "o" });

    // Add 4 controls to get residualLikelihood=1.89, residualImpact=4.0
    await Risk.updateOne({ riskId: created.riskId, organizationId: ORG_A }, {
      $set: {
        residualLikelihood: 1.89,
        residualImpact: 4.0,
        residualScore: 7.56,
        residualLevel: "Medium",
      },
    });

    const result = await matrixService.getMatrix({ organizationId: ORG_A }, { basis: "residual", includeClosed: false });
    const cell = result.cells.find(c => c.likelihood === 2 && c.impact === 4)!;
    expect(cell.count).toBe(1);
  });

  it("avoided risk (residualScore=0) counted in notPlotted", async () => {
    const asset = await makeAsset(ORG_A);
    await riskService.createRisk(CTX_A, { assetId: asset._id.toString(), threatKey: "thr_data_breach", vulnerabilityKey: "vul_weak_access_control", likelihood: 4, impact: 5, owner: "o" });
    // Set as avoided
    await Risk.updateOne({ organizationId: ORG_A }, { $set: { residualScore: 0, residualLikelihood: 0, residualImpact: 0 } });

    const result = await matrixService.getMatrix({ organizationId: ORG_A }, { basis: "residual", includeClosed: false });
    expect(result.notPlotted).toBe(1);
    expect(result.totalPlotted).toBe(0);
  });

  it("Closed risks excluded by default, included with includeClosed", async () => {
    const asset = await makeAsset(ORG_A);
    const created = await riskService.createRisk(CTX_A, { assetId: asset._id.toString(), threatKey: "thr_data_breach", vulnerabilityKey: "vul_weak_access_control", likelihood: 4, impact: 5, owner: "o" });
    await Risk.updateOne({ riskId: created.riskId, organizationId: ORG_A }, { $set: { status: "Closed" } });

    const without = await matrixService.getMatrix({ organizationId: ORG_A }, { basis: "inherent", includeClosed: false });
    expect(without.totalPlotted).toBe(0);

    const withClosed = await matrixService.getMatrix({ organizationId: ORG_A }, { basis: "inherent", includeClosed: true });
    expect(withClosed.totalPlotted).toBe(1);
  });

  it("assetId filter works", async () => {
    const asset1 = await makeAsset(ORG_A, { name: "DB1" });
    const asset2 = await makeAsset(ORG_A, { name: "DB2" });
    await riskService.createRisk(CTX_A, { assetId: asset1._id.toString(), threatKey: "thr_data_breach", vulnerabilityKey: "vul_weak_access_control", likelihood: 4, impact: 5, owner: "o" });
    await riskService.createRisk(CTX_A, { assetId: asset2._id.toString(), threatKey: "thr_data_breach", vulnerabilityKey: "vul_weak_access_control", likelihood: 2, impact: 2, owner: "o" });

    const filtered = await matrixService.getMatrix({ organizationId: ORG_A }, { basis: "inherent", includeClosed: false, assetId: asset1._id.toString() });
    expect(filtered.totalPlotted).toBe(1);
    const cell = filtered.cells.find(c => c.likelihood === 4 && c.impact === 5)!;
    expect(cell.count).toBe(1);
  });
});

// ── Tenant isolation ──────────────────────────────────────────────────────────
describe("Tenant isolation", () => {
  it("org B cannot see, update, delete, or get history of org A risks", async () => {
    const assetA = await makeAsset(ORG_A, { name: "Org A Asset" });
    const riskA = await riskService.createRisk(CTX_A, { assetId: assetA._id.toString(), threatKey: "thr_data_breach", vulnerabilityKey: "vul_weak_access_control", likelihood: 4, impact: 5, owner: "o" });

    // getRisk from B -> 404
    await expect(riskService.getRisk(CTX_B, riskA.riskId)).rejects.toMatchObject({ statusCode: 404 });

    // updateRisk from B -> 404
    await expect(riskService.updateRisk(CTX_B, riskA.riskId, { likelihood: 1, impact: 1, owner: "b", notes: "", expectedUpdatedAt: riskA.updatedAt })).rejects.toMatchObject({ statusCode: 404 });

    // deleteRisk from B -> 404
    await expect(riskService.deleteRisk(CTX_B, riskA.riskId)).rejects.toMatchObject({ statusCode: 404 });

    // getRiskHistory from B -> 404
    await expect(riskService.getRiskHistory(CTX_B, riskA.riskId)).rejects.toMatchObject({ statusCode: 404 });

    // listRisks from B -> empty
    const listB = await riskService.listRisks(CTX_B, { basis: "residual", sort: "riskId", order: "asc", page: 1, limit: 20 });
    expect(listB.items).toHaveLength(0);

    // A's risk is unchanged
    const stillExists = await riskService.getRisk(CTX_A, riskA.riskId);
    expect(stillExists.likelihood).toBe(4);
  });
});

// ── deleteRisk ────────────────────────────────────────────────────────────────
describe("riskService.deleteRisk", () => {
  it("deletes risk and creates audit entry", async () => {
    const asset = await makeAsset(ORG_A);
    const created = await riskService.createRisk(CTX_A, { assetId: asset._id.toString(), threatKey: "thr_data_breach", vulnerabilityKey: "vul_weak_access_control", likelihood: 4, impact: 5, owner: "o" });

    await riskService.deleteRisk(CTX_A, created.riskId);

    await expect(riskService.getRisk(CTX_A, created.riskId)).rejects.toMatchObject({ statusCode: 404 });

    const auditEntry = await AuditLog.findOne({ entityId: created.id, action: "risk.delete" }).lean();
    expect(auditEntry).not.toBeNull();
    expect((auditEntry!.changes!.before as { riskId: string }).riskId).toBe(created.riskId);
    expect(auditEntry!.changes!.after).toBeNull();
  });

  it("404 on second delete", async () => {
    const asset = await makeAsset(ORG_A);
    const created = await riskService.createRisk(CTX_A, { assetId: asset._id.toString(), threatKey: "thr_data_breach", vulnerabilityKey: "vul_weak_access_control", likelihood: 4, impact: 5, owner: "o" });
    await riskService.deleteRisk(CTX_A, created.riskId);
    await expect(riskService.deleteRisk(CTX_A, created.riskId)).rejects.toMatchObject({ statusCode: 404 });
  });
});
