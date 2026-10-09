import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { runSeed } from "@/scripts/seed";
import { recommendationService } from "@/services/recommendationService";

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await runSeed();
});

describe("Recommendations Engine and Service", () => {
  const orgA = { organizationId: "orgA" };

  it("cascadeThreats returns threats applicable to asset type", async () => {
    const threats = await recommendationService.getCascade(orgA, { assetType: "Database" });
    expect(threats.length).toBeGreaterThanOrEqual(3);
    threats.forEach((t: any) => expect(t.applicableAssetTypes).toContain("Database"));
  });

  it("cascadeVulnerabilities respects threat link and asset type, severity-sorted", async () => {
    const vuls = await recommendationService.getCascade(orgA, { assetType: "Database", threatKey: "thr_data_breach" });
    expect(vuls.length).toBeGreaterThan(0);
    expect((vuls[0] as any).severity).toBe("Critical");
    vuls.forEach((v: any) => expect(v.applicableAssetTypes).toContain("Database"));
  });

  it("recommendControls for Database + thr_data_breach + vul_weak_access_control", async () => {
    const res = await recommendationService.getRecommendations(orgA, {
      assetType: "Database",
      threatKey: "thr_data_breach",
      vulnerabilityKey: "vul_weak_access_control"
    });
    
    expect(res.recommendations.length).toBe(4);
    const controlKeys = res.recommendations.map((r: any) => r.control.key);
    expect(controlKeys).toContain("ctl_rbac");
    expect(controlKeys).toContain("ctl_mfa");
    expect(controlKeys).toContain("ctl_access_monitoring");
    expect(controlKeys).toContain("ctl_db_encryption");

    // Check ranking: effectiveness desc, cost asc, name asc
    for (let i = 0; i < res.recommendations.length - 1; i++) {
      const a = res.recommendations[i].control;
      const b = res.recommendations[i + 1].control;
      if (a.effectiveness === b.effectiveness) {
        // We know from data that costs are low, medium, high
        const costs = { Low: 1, Medium: 2, High: 3 };
        const aCost = costs[a.implementationCost as keyof typeof costs];
        const bCost = costs[b.implementationCost as keyof typeof costs];
        expect(aCost).toBeLessThanOrEqual(bCost);
        if (aCost === bCost) {
          expect(a.name.localeCompare(b.name)).toBeLessThanOrEqual(0);
        }
      } else {
        expect(a.effectiveness).toBeGreaterThanOrEqual(b.effectiveness);
      }
    }
  });

  it("calculates deltas and final score when likelihood and impact are given", async () => {
    const res = await recommendationService.getRecommendations(orgA, {
      assetType: "Database",
      threatKey: "thr_data_breach",
      vulnerabilityKey: "vul_weak_access_control",
      likelihood: 4,
      impact: 5,
      excludeControlKeys: []
    });

    expect(res.baseline).toBeDefined();
    expect(res.baseline?.score).toBe(20);
    expect(res.projectedFinal?.score).toBeCloseTo(7.56, 2);
    expect(res.projectedFinal?.level).toBe("Medium");

    let sum = 0;
    res.recommendations.forEach((r: any) => {
      expect(r.delta).toBeLessThanOrEqual(0);
      sum += r.delta;
    });
    expect(20 + sum).toBeCloseTo(7.56, 2);
  });
});
