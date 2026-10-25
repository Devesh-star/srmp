import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { runSeed } from "@/scripts/seed";
import { Asset } from "@/models/Asset";
import { GET as getDashboard } from "@/app/api/dashboard/route";
import * as dashboardRouteModule from "@/app/api/dashboard/route";
import { GET as listAssetRisk } from "@/app/api/asset-risk/route";
import * as assetRiskRouteModule from "@/app/api/asset-risk/route";
import { GET as getAssetRisk } from "@/app/api/asset-risk/[assetId]/route";
import * as assetRiskDetailRouteModule from "@/app/api/asset-risk/[assetId]/route";
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

describe("Dashboard & Asset Risk API Routes", () => {
  it("exports no write handlers (GET only)", () => {
    expect((dashboardRouteModule as Record<string, unknown>).POST).toBeUndefined();
    expect((dashboardRouteModule as Record<string, unknown>).PUT).toBeUndefined();
    expect((dashboardRouteModule as Record<string, unknown>).DELETE).toBeUndefined();

    expect((assetRiskRouteModule as Record<string, unknown>).POST).toBeUndefined();
    expect((assetRiskRouteModule as Record<string, unknown>).PUT).toBeUndefined();
    expect((assetRiskRouteModule as Record<string, unknown>).DELETE).toBeUndefined();

    expect((assetRiskDetailRouteModule as Record<string, unknown>).POST).toBeUndefined();
    expect((assetRiskDetailRouteModule as Record<string, unknown>).PUT).toBeUndefined();
    expect((assetRiskDetailRouteModule as Record<string, unknown>).DELETE).toBeUndefined();
  });

  describe("Authentication & Role Authorization", () => {
    it("returns 401 when no session is present", async () => {
      mockAuth.mockResolvedValue(null);

      const r1 = await getDashboard(new Request("http://localhost/api/dashboard"));
      expect(r1.status).toBe(401);

      const r2 = await listAssetRisk(new Request("http://localhost/api/asset-risk"));
      expect(r2.status).toBe(401);

      const r3 = await getAssetRisk(
        new Request("http://localhost/api/asset-risk/dummyId"),
        { params: Promise.resolve({ assetId: "dummyId" }) }
      );
      expect(r3.status).toBe(401);
    });

    it("allows viewer, assessor, and admin roles to GET", async () => {
      for (const role of ["viewer", "assessor", "admin"]) {
        mockAuth.mockResolvedValue(makeSession(role));

        const r1 = await getDashboard(new Request("http://localhost/api/dashboard"));
        expect(r1.status).toBe(200);
        expect(r1.headers.get("Cache-Control")).toBe("no-store");

        const r2 = await listAssetRisk(new Request("http://localhost/api/asset-risk"));
        expect(r2.status).toBe(200);
        expect(r2.headers.get("Cache-Control")).toBe("no-store");
      }
    });
  });

  describe("Query Validation & Input Sanitization", () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue(makeSession("viewer"));
    });

    it("returns 400 on invalid dashboard query params", async () => {
      const res = await getDashboard(new Request("http://localhost/api/dashboard?basis=invalid"));
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.message).toBe("Validation error");
      expect(json.stack).toBeUndefined();
    });

    it("returns 400 on invalid asset risk query params", async () => {
      const res = await listAssetRisk(
        new Request("http://localhost/api/asset-risk?includeUnassessed=badValue")
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.message).toBe("Validation error");
      expect(json.stack).toBeUndefined();
    });

    it("returns 404 for bad assetId in detail endpoint", async () => {
      const res = await getAssetRisk(
        new Request("http://localhost/api/asset-risk/not_a_valid_id"),
        { params: Promise.resolve({ assetId: "not_a_valid_id" }) }
      );
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.message).toBe("Asset not found");
      expect(json.stack).toBeUndefined();
    });

    it("returns 200 with valid detail when asset exists", async () => {
      const asset = await Asset.findOne({ organizationId: "org_default" });
      expect(asset).not.toBeNull();

      const res = await getAssetRisk(
        new Request(`http://localhost/api/asset-risk/${asset!._id}`),
        { params: Promise.resolve({ assetId: asset!._id.toString() }) }
      );
      expect(res.status).toBe(200);
      expect(res.headers.get("Cache-Control")).toBe("no-store");
      const json = await res.json();
      expect(json.name).toBe(asset!.name);
      expect(Array.isArray(json.risks)).toBe(true);
    });
  });
});
