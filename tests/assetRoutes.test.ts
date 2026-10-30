import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { runSeed } from "@/scripts/seed";
import { Asset } from "@/models/Asset";
import { AuditLog } from "@/models/AuditLog";
import { GET as listAssets, POST as createAsset } from "@/app/api/assets/route";
import { POST as createRisk } from "@/app/api/risks/route";
import * as authModule from "@/auth";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

const mockAuth = authModule.auth as ReturnType<typeof vi.fn>;

let mongoServer: MongoMemoryServer;

function makeSession(role: string, orgId = "org_default") {
  return { user: { role, organizationId: orgId, id: `user_${role}` } };
}

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  await runSeed({ organizationId: "org_default", actorId: "admin" });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(() => {
  mockAuth.mockReset();
});

describe("Asset Management & Assessment Routes", () => {
  describe("Authentication & Authorization", () => {
    it("returns 401 when no session is present", async () => {
      mockAuth.mockResolvedValue(null);
      const res = await listAssets(new Request("http://localhost/api/assets"));
      expect(res.status).toBe(401);
    });

    it("prevents viewers from creating assets (403)", async () => {
      mockAuth.mockResolvedValue(makeSession("viewer"));
      const res = await createAsset(
        new Request("http://localhost/api/assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Secret Server",
            type: "Server",
            owner: "Ops",
            confidentiality: 4,
            integrity: 4,
            availability: 4,
          }),
        })
      );
      expect(res.status).toBe(403);
    });
  });

  describe("Asset Creation & Listing", () => {
    it("creates a new asset and logs audit entry", async () => {
      mockAuth.mockResolvedValue(makeSession("admin"));
      const req = new Request("http://localhost/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Payment Processing Gateway",
          type: "Web Application",
          owner: "FinTech Team",
          confidentiality: 5,
          integrity: 5,
          availability: 4,
          description: "PCI-DSS in-scope payment tokenization server",
        }),
      });

      const res = await createAsset(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.name).toBe("Payment Processing Gateway");
      expect(data.criticality).toBe(5);

      // Verify Audit Log
      const audit = await AuditLog.findOne({
        action: "asset.create",
        entityId: data.id,
      });
      expect(audit).not.toBeNull();
      expect(audit?.actor).toBe("user_admin");
    });

    it("rejects duplicate asset name in the same org (409)", async () => {
      mockAuth.mockResolvedValue(makeSession("admin"));
      const req = new Request("http://localhost/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "payment processing gateway", // case-insensitive duplicate
          type: "Server",
          owner: "Other Team",
          confidentiality: 3,
          integrity: 3,
          availability: 3,
        }),
      });

      const res = await createAsset(req);
      expect(res.status).toBe(409);
    });

    it("rejects invalid CIA scores > 5", async () => {
      mockAuth.mockResolvedValue(makeSession("admin"));
      const req = new Request("http://localhost/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Faulty Asset",
          type: "Server",
          owner: "Tester",
          confidentiality: 6, // Invalid
          integrity: 3,
          availability: 3,
        }),
      });

      const res = await createAsset(req);
      expect(res.status).toBe(400);
    });

    it("lists assets scoped to the organization", async () => {
      mockAuth.mockResolvedValue(makeSession("viewer"));
      const res = await listAssets(
        new Request("http://localhost/api/assets?q=Payment")
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.items.length).toBeGreaterThanOrEqual(1);
      expect(data.items.some((a: { name: string }) => a.name === "Payment Processing Gateway")).toBe(true);
    });
  });

  describe("Risk Assessment on New Asset", () => {
    it("creates a risk on the newly created asset with pure scoring", async () => {
      mockAuth.mockResolvedValue(makeSession("admin"));

      // 1. Fetch newly created asset
      const asset = await Asset.findOne({
        name: "Payment Processing Gateway",
        organizationId: "org_default",
      });
      expect(asset).not.toBeNull();

      // 2. Assess a risk against this asset
      const riskReq = new Request("http://localhost/api/risks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: asset!._id.toString(),
          threatKey: "thr_sql_injection",
          vulnerabilityKey: "vul_poor_input_validation",
          likelihood: 4,
          impact: 5,
          owner: "SecOps Lead",
          notes: "Critical gateway vulnerable to injection payloads",
        }),
      });

      const riskRes = await createRisk(riskReq);
      expect(riskRes.status).toBe(201);
      const riskData = await riskRes.json();
      expect(riskData.inherentScore).toBe(20);
      expect(riskData.inherentLevel).toBe("Critical");
      expect(riskData.residualScore).toBe(20);
      expect(riskData.asset.name).toBe("Payment Processing Gateway");
    });
  });
});
