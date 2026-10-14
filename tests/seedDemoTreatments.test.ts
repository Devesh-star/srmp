import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { runSeed } from "@/scripts/seed";
import { Assessment } from "@/models/Assessment";
import { Risk } from "@/models/Risk";
import { Asset } from "@/models/Asset";
import { AuditLog } from "@/models/AuditLog";
import { Counter } from "@/models/Counter";

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
  await Risk.deleteMany({});
  await Asset.deleteMany({});
  await Assessment.deleteMany({});
  await AuditLog.deleteMany({});
  await Counter.deleteMany({});
});

describe("scripts/seed.ts: seedDemoTreatments idempotency & multi-stage history", () => {
  it("seeding twice creates exactly 3 snapshots, student database risk ends at ~7.56, and S1 > S2 > S3", async () => {
    // 1st run
    await runSeed();

    const snapshotsFirst = await Assessment.find({ organizationId: "org_default" })
      .sort({ date: 1 })
      .lean();

    expect(snapshotsFirst.length).toBe(3);
    const [s1, s2, s3] = snapshotsFirst;

    expect(s1.label).toBe("Initial assessment");
    expect(s2.label).toBe("After first treatments");
    expect(s3.label).toBe("Current state");

    // Trajectory: overallScore drops over time
    expect(s1.overallScore).toBeGreaterThan(s2.overallScore);
    expect(s2.overallScore).toBeGreaterThan(s3.overallScore);

    // Initial assessment equals inherent overall of data
    expect(s1.overallScore).toBe(s1.inherentOverall);

    // Verify Student Database risk ending score
    const studentDbRisk = await Risk.findOne({
      organizationId: "org_default",
      threatId: "thr_data_breach",
    }).lean();
    expect(studentDbRisk).not.toBeNull();
    expect(studentDbRisk!.residualScore).toBeCloseTo(7.56, 2);
    expect(studentDbRisk!.residualLevel).toBe("Medium");
    expect(studentDbRisk!.status).toBe("Mitigated");

    // 2nd run (idempotency check)
    await runSeed();

    const snapshotsSecond = await Assessment.find({ organizationId: "org_default" })
      .sort({ date: 1 })
      .lean();

    expect(snapshotsSecond.length).toBe(3); // Exactly 3 snapshots, no duplicates

    const studentDbRiskSecond = await Risk.findOne({
      organizationId: "org_default",
      threatId: "thr_data_breach",
    }).lean();
    expect(studentDbRiskSecond!.residualScore).toBeCloseTo(7.56, 2);
  });
});
