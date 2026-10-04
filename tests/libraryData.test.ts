import { describe, it, expect } from "vitest";
import { threats, vulnerabilities, controls, ASSET_TYPES } from "../data";

describe("Library Data Integrity", () => {
  it("has exactly 20 threats, 20 vulnerabilities, 20 controls", () => {
    expect(threats.length).toBe(20);
    expect(vulnerabilities.length).toBe(20);
    expect(controls.length).toBe(20);
  });

  it("has unique IDs matching their prefix pattern", () => {
    const thrIds = new Set(threats.map((t) => t.id));
    const vulIds = new Set(vulnerabilities.map((v) => v.id));
    const ctlIds = new Set(controls.map((c) => c.id));

    expect(thrIds.size).toBe(20);
    expect(vulIds.size).toBe(20);
    expect(ctlIds.size).toBe(20);

    threats.forEach((t) => expect(t.id).toMatch(/^thr_[a-z0-9_]+$/));
    vulnerabilities.forEach((v) => expect(v.id).toMatch(/^vul_[a-z0-9_]+$/));
    controls.forEach((c) => expect(c.id).toMatch(/^ctl_[a-z0-9_]+$/));
  });

  it("every referenced id exists and no orphans", () => {
    const allVulIds = new Set(vulnerabilities.map((v) => v.id));
    const allCtlIds = new Set(controls.map((c) => c.id));
    
    const referencedVulIds = new Set<string>();
    const referencedCtlIds = new Set<string>();

    threats.forEach((t) => {
      expect(t.vulnerabilityIds.length).toBeGreaterThanOrEqual(1);
      t.vulnerabilityIds.forEach((vid) => {
        expect(allVulIds.has(vid)).toBe(true);
        referencedVulIds.add(vid);
      });
    });

    vulnerabilities.forEach((v) => {
      expect(v.recommendedControlIds.length).toBeGreaterThanOrEqual(1);
      v.recommendedControlIds.forEach((cid) => {
        expect(allCtlIds.has(cid)).toBe(true);
        referencedCtlIds.add(cid);
      });
    });

    expect(referencedVulIds.size).toBe(20);
    expect(referencedCtlIds.size).toBe(20);
  });

  it("control effectiveness is > 0 and <= 0.5", () => {
    controls.forEach((c) => {
      expect(c.effectiveness).toBeGreaterThan(0);
      expect(c.effectiveness).toBeLessThanOrEqual(0.5);
    });
  });

  it("every asset type is applicable to >= 3 threats", () => {
    const assetCounts = new Map(ASSET_TYPES.map(a => [a, 0]));
    threats.forEach(t => {
      t.applicableAssetTypes.forEach(a => {
        assetCounts.set(a, assetCounts.get(a)! + 1);
      });
    });
    assetCounts.forEach((count, asset) => {
      expect(count, `${asset} only has ${count} threats`).toBeGreaterThanOrEqual(3);
    });
  });

  it("names and descriptions are non-empty", () => {
    threats.forEach(t => {
      expect(t.name.trim().length).toBeGreaterThan(0);
      expect(t.description.trim().length).toBeGreaterThan(0);
    });
    vulnerabilities.forEach(v => {
      expect(v.name.trim().length).toBeGreaterThan(0);
      expect(v.description.trim().length).toBeGreaterThan(0);
    });
    controls.forEach(c => {
      expect(c.name.trim().length).toBeGreaterThan(0);
      expect(c.description.trim().length).toBeGreaterThan(0);
    });
  });

  it("pinned demo ids, values and links exist as specified", () => {
    const rbac = controls.find(c => c.id === "ctl_rbac");
    expect(rbac?.reduces).toBe("likelihood");
    expect(rbac?.effectiveness).toBe(0.30);

    const mfa = controls.find(c => c.id === "ctl_mfa");
    expect(mfa?.reduces).toBe("likelihood");
    expect(mfa?.effectiveness).toBe(0.25);

    const am = controls.find(c => c.id === "ctl_access_monitoring");
    expect(am?.reduces).toBe("likelihood");
    expect(am?.effectiveness).toBe(0.10);

    const dbe = controls.find(c => c.id === "ctl_db_encryption");
    expect(dbe?.reduces).toBe("impact");
    expect(dbe?.effectiveness).toBe(0.20);

    const edr = controls.find(c => c.id === "ctl_edr");
    expect(edr?.reduces).toBe("likelihood");

    const ob = controls.find(c => c.id === "ctl_offline_backup");
    expect(ob?.reduces).toBe("impact");

    const pm = controls.find(c => c.id === "ctl_patch_management");
    expect(pm?.reduces).toBe("likelihood");

    const ns = controls.find(c => c.id === "ctl_network_segmentation");
    expect(ns?.reduces).toBe("impact");

    const thrDB = threats.find(t => t.id === "thr_data_breach");
    expect(thrDB?.ciaTarget).toBe("C");
    expect(thrDB?.vulnerabilityIds).toContain("vul_weak_access_control");

    const vulWAC = vulnerabilities.find(v => v.id === "vul_weak_access_control");
    expect(vulWAC?.recommendedControlIds).toContain("ctl_rbac");
    expect(vulWAC?.recommendedControlIds).toContain("ctl_mfa");
    expect(vulWAC?.recommendedControlIds).toContain("ctl_access_monitoring");
    expect(vulWAC?.recommendedControlIds).toContain("ctl_db_encryption");

    const thrRan = threats.find(t => t.id === "thr_ransomware");
    expect(thrRan?.ciaTarget).toBe("A");
    
    // ransomware must be linked to vulnerabilities whose recommended controls include those 4
    const ranCtls = new Set<string>();
    thrRan?.vulnerabilityIds.forEach(vid => {
      const v = vulnerabilities.find(x => x.id === vid);
      v?.recommendedControlIds.forEach(cid => ranCtls.add(cid));
    });
    
    expect(ranCtls.has("ctl_edr")).toBe(true);
    expect(ranCtls.has("ctl_offline_backup")).toBe(true);
    expect(ranCtls.has("ctl_patch_management")).toBe(true);
    expect(ranCtls.has("ctl_network_segmentation")).toBe(true);
  });
});
