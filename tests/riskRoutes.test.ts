import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as listRisks, POST as createRisk } from "@/app/api/risks/route";
import { GET as getMatrix } from "@/app/api/risks/matrix/route";
import { PUT as putControls } from "@/app/api/risks/[riskId]/controls/route";
import { PUT as putTreatment } from "@/app/api/risks/[riskId]/treatment/route";
import { POST as postClose } from "@/app/api/risks/[riskId]/close/route";
import { POST as postReopen } from "@/app/api/risks/[riskId]/reopen/route";
import { POST as postSimulate } from "@/app/api/risks/[riskId]/simulate/route";
import {
  GET as listAssessments,
  POST as createAssessment,
} from "@/app/api/assessments/route";
import { GET as getTrend } from "@/app/api/assessments/trend/route";
import {
  GET as getAssessment,
  DELETE as deleteAssessment,
} from "@/app/api/assessments/[id]/route";
import * as authModule from "@/auth";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

const mockAuth = authModule.auth as ReturnType<typeof vi.fn>;

function makeSession(role: string, orgId = "orgTest") {
  return { user: { role, organizationId: orgId, id: `user_${role}` } };
}

describe("Risk & Assessment API routes — auth/role checks", () => {
  beforeEach(() => {
    mockAuth.mockReset();
  });

  // ── No session -> 401 everywhere ──────────────────────────────────────────
  it("401 when no session is present", async () => {
    mockAuth.mockResolvedValue(null);

    const r1 = await listRisks(new Request("http://localhost/api/risks"));
    expect(r1.status).toBe(401);

    const r2 = await getMatrix(new Request("http://localhost/api/risks/matrix"));
    expect(r2.status).toBe(401);

    const r3 = await putControls(
      new Request("http://localhost/api/risks/R001/controls", { method: "PUT" }),
      { params: Promise.resolve({ riskId: "R001" }) }
    );
    expect(r3.status).toBe(401);

    const r4 = await putTreatment(
      new Request("http://localhost/api/risks/R001/treatment", { method: "PUT" }),
      { params: Promise.resolve({ riskId: "R001" }) }
    );
    expect(r4.status).toBe(401);

    const r5 = await postClose(
      new Request("http://localhost/api/risks/R001/close", { method: "POST" }),
      { params: Promise.resolve({ riskId: "R001" }) }
    );
    expect(r5.status).toBe(401);

    const r6 = await postReopen(
      new Request("http://localhost/api/risks/R001/reopen", { method: "POST" }),
      { params: Promise.resolve({ riskId: "R001" }) }
    );
    expect(r6.status).toBe(401);

    const r7 = await postSimulate(
      new Request("http://localhost/api/risks/R001/simulate", { method: "POST" }),
      { params: Promise.resolve({ riskId: "R001" }) }
    );
    expect(r7.status).toBe(401);

    const r8 = await listAssessments(new Request("http://localhost/api/assessments"));
    expect(r8.status).toBe(401);

    const r9 = await createAssessment(
      new Request("http://localhost/api/assessments", { method: "POST" })
    );
    expect(r9.status).toBe(401);

    const r10 = await getTrend(new Request("http://localhost/api/assessments/trend"));
    expect(r10.status).toBe(401);

    const r11 = await getAssessment(
      new Request("http://localhost/api/assessments/123"),
      { params: Promise.resolve({ id: "123" }) }
    );
    expect(r11.status).toBe(401);

    const r12 = await deleteAssessment(
      new Request("http://localhost/api/assessments/123", { method: "DELETE" }),
      { params: Promise.resolve({ id: "123" }) }
    );
    expect(r12.status).toBe(401);
  });

  // ── Viewer role -> 403 on mutation endpoints ──────────────────────────────
  it("Viewer gets 403 on mutation routes (role checked before parsing/DB)", async () => {
    mockAuth.mockResolvedValue(makeSession("viewer"));

    const r1 = await createRisk(
      new Request("http://localhost/api/risks", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "content-length": "2" },
      })
    );
    expect(r1.status).toBe(403);

    const r2 = await putControls(
      new Request("http://localhost/api/risks/R001/controls", {
        method: "PUT",
        body: JSON.stringify({}),
        headers: { "content-length": "2" },
      }),
      { params: Promise.resolve({ riskId: "R001" }) }
    );
    expect(r2.status).toBe(403);

    const r3 = await putTreatment(
      new Request("http://localhost/api/risks/R001/treatment", {
        method: "PUT",
        body: JSON.stringify({}),
        headers: { "content-length": "2" },
      }),
      { params: Promise.resolve({ riskId: "R001" }) }
    );
    expect(r3.status).toBe(403);

    const r4 = await postClose(
      new Request("http://localhost/api/risks/R001/close", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "content-length": "2" },
      }),
      { params: Promise.resolve({ riskId: "R001" }) }
    );
    expect(r4.status).toBe(403);

    const r5 = await postReopen(
      new Request("http://localhost/api/risks/R001/reopen", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "content-length": "2" },
      }),
      { params: Promise.resolve({ riskId: "R001" }) }
    );
    expect(r5.status).toBe(403);

    const r6 = await createAssessment(
      new Request("http://localhost/api/assessments", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "content-length": "2" },
      })
    );
    expect(r6.status).toBe(403);

    const r7 = await deleteAssessment(
      new Request("http://localhost/api/assessments/123", { method: "DELETE" }),
      { params: Promise.resolve({ id: "123" }) }
    );
    expect(r7.status).toBe(403);
  });

  // ── Assessor role -> 403 on DELETE assessment (admin only) ────────────────
  it("Assessor gets 403 on DELETE assessment", async () => {
    mockAuth.mockResolvedValue(makeSession("assessor"));

    const r = await deleteAssessment(
      new Request("http://localhost/api/assessments/123", { method: "DELETE" }),
      { params: Promise.resolve({ id: "123" }) }
    );
    expect(r.status).toBe(403);
  });

  // ── Body size limit (413) ──────────────────────────────────────────────────
  it("Request body > 10 KB -> 413", async () => {
    mockAuth.mockResolvedValue(makeSession("admin"));

    const r = await createRisk(
      new Request("http://localhost/api/risks", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "content-length": "20000" },
      })
    );
    expect(r.status).toBe(413);
  });

  // ── Operator injection rejection (400) ────────────────────────────────────
  it("Operator injection in body is rejected by Zod (400)", async () => {
    mockAuth.mockResolvedValue(makeSession("admin"));

    const malicious = JSON.stringify({ "$ne": "" });
    const len = malicious.length;
    const res = await createRisk(
      new Request("http://localhost/api/risks", {
        method: "POST",
        body: malicious,
        headers: { "content-length": String(len) },
      })
    );
    expect(res.status).toBe(400);
  });

  // ── Invalid riskId in params -> 404 ───────────────────────────────────────
  it("Invalid riskId param format -> 404", async () => {
    mockAuth.mockResolvedValue(makeSession("admin"));

    const res = await putControls(
      new Request("http://localhost/api/risks/invalid-id/controls", {
        method: "PUT",
        body: JSON.stringify({ controls: [], expectedUpdatedAt: "2026-10-01T00:00:00.000Z" }),
        headers: { "content-length": "60" },
      }),
      { params: Promise.resolve({ riskId: "invalid-id" }) }
    );
    expect(res.status).toBe(404);
  });
});
