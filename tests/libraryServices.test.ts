import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { runSeed } from "@/scripts/seed";
import { libraryService } from "@/services/libraryService";
import { recommendationService } from "@/services/recommendationService";
import { Threat } from "@/models/Threat";
import { Vulnerability } from "@/models/Vulnerability";
import { Control } from "@/models/Control";

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
  await Threat.deleteMany({});
  await Vulnerability.deleteMany({});
  await Control.deleteMany({});
  await runSeed();
});

describe("Library Services", () => {
  const orgA = { organizationId: "orgA", actor: "userA" };
  const orgB = { organizationId: "orgB", actor: "userB" };

  it("list shows global + own custom only; org B's custom rows are invisible to A", async () => {
    await libraryService.createControl(orgB, { name: "OrgB Control", category: "Technical", description: "d", effectiveness: 0.1, reduces: "impact", implementationCost: "Low" });
    
    const listA = await libraryService.listControls(orgA, { page: 1, limit: 100, scope: "all" });
    expect(listA.total).toBe(20);
    expect(listA.items.find((i: any) => i.name === "OrgB Control")).toBeUndefined();
    
    const listB = await libraryService.listControls(orgB, { page: 1, limit: 100, scope: "all" });
    expect(listB.total).toBe(21);
    expect(listB.items.find((i: any) => i.name === "OrgB Control")).toBeDefined();
  });

  it("searching '.' and '(' doesn't throw and matches only literals", async () => {
    await libraryService.createControl(orgA, { name: "Control (Test)", category: "Technical", description: "d.", effectiveness: 0.1, reduces: "impact", implementationCost: "Low" });
    
    const res1 = await libraryService.listControls(orgA, { q: "(", page: 1, limit: 100, scope: "all" });
    expect(res1.items.some((i: any) => i.name === "Control (Test)")).toBe(true);

    const res2 = await libraryService.listControls(orgA, { q: ".", page: 1, limit: 100, scope: "all" });
    expect(res2.items.some((i: any) => i.name === "Control (Test)")).toBe(true);
  });

  it("create custom threat", async () => {
    const ctl = await libraryService.createControl(orgA, { name: "Custom Control", category: "Technical", description: "d", effectiveness: 0.1, reduces: "impact", implementationCost: "Low" });
    const vul = await libraryService.createVulnerability(orgA, { name: "Custom Vul", description: "d", severity: "High", applicableAssetTypes: ["Database"], recommendedControlKeys: [ctl.key] });
    
    // references to org B's custom keys -> 400
    const vulB = await libraryService.createVulnerability(orgB, { name: "Custom Vul B", description: "d", severity: "High", applicableAssetTypes: ["Database"], recommendedControlKeys: [] });
    await expect(libraryService.createThreat(orgA, {
      name: "Custom Threat", category: "Cyber", description: "d", potentialImpact: "d", ciaTarget: "C", applicableAssetTypes: ["Database"], vulnerabilityKeys: [vulB.key]
    })).rejects.toThrow(/Unknown keys/);

    const thr = await libraryService.createThreat(orgA, {
      name: "Custom Threat", category: "Cyber", description: "d", potentialImpact: "d", ciaTarget: "C", applicableAssetTypes: ["Database"], vulnerabilityKeys: [vul.key]
    });
    expect(thr.key).toMatch(/^thr_custom_/);

    // duplicate name -> 409
    await expect(libraryService.createThreat(orgA, {
      name: "Custom Threat", category: "Cyber", description: "d", potentialImpact: "d", ciaTarget: "C", applicableAssetTypes: ["Database"], vulnerabilityKeys: [vul.key]
    })).rejects.toThrow(/already exists/);

    // allowed in org B
    await expect(libraryService.createThreat(orgB, {
      name: "Custom Threat", category: "Cyber", description: "d", potentialImpact: "d", ciaTarget: "C", applicableAssetTypes: ["Database"], vulnerabilityKeys: []
    })).resolves.toBeDefined();
  });

  it("update/delete a global row -> 403; update custom works, key stable", async () => {
    const globalControls = await libraryService.listControls(orgA, { scope: "global", page: 1, limit: 100 });
    const globalKey = globalControls.items[0].key;
    
    await expect(libraryService.updateControl(orgA, globalKey, { name: "New Name", category: "Technical", description: "d", effectiveness: 0.1, reduces: "impact", implementationCost: "Low" })).rejects.toThrow(/read-only/);
    await expect(libraryService.deleteControl(orgA, globalKey)).rejects.toThrow(/read-only/);

    const ctl = await libraryService.createControl(orgA, { name: "Custom Control", category: "Technical", description: "d", effectiveness: 0.1, reduces: "impact", implementationCost: "Low" });
    const updated = await libraryService.updateControl(orgA, ctl.key, { name: "Updated Name", category: "Technical", description: "d", effectiveness: 0.1, reduces: "impact", implementationCost: "Low" });
    expect(updated.key).toBe(ctl.key);
    expect(updated.name).toBe("Updated Name");
  });
});
