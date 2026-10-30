import mongoose from "mongoose";
import { Threat } from "@/models/Threat";
import { Vulnerability } from "@/models/Vulnerability";
import { Control } from "@/models/Control";
import { Asset } from "@/models/Asset";
import { Risk } from "@/models/Risk";
import { Assessment } from "@/models/Assessment";
import { threats, vulnerabilities, controls } from "@/data";
import { riskService } from "@/services/riskService";
import { assessmentService } from "@/services/assessmentService";

export interface SeedCtx {
  organizationId: string;
  actorId: string;
}

export async function seedLibrary() {
  await Threat.deleteMany({ organizationId: null });
  await Vulnerability.deleteMany({ organizationId: null });
  await Control.deleteMany({ organizationId: null });

  const mappedControls = controls.map((c) => ({
    ...c,
    key: c.id,
    organizationId: null,
  }));
  await Control.insertMany(mappedControls);

  const mappedVuls = vulnerabilities.map((v) => ({
    ...v,
    key: v.id,
    recommendedControlKeys: v.recommendedControlIds,
    organizationId: null,
  }));
  await Vulnerability.insertMany(mappedVuls);

  const mappedThreats = threats.map((t) => ({
    ...t,
    key: t.id,
    vulnerabilityKeys: t.vulnerabilityIds,
    organizationId: null,
  }));
  await Threat.insertMany(mappedThreats);
}

export async function seedDemoRisks(ctx: SeedCtx) {
  const existingRisks = await Risk.countDocuments({
    organizationId: ctx.organizationId,
  });
  if (existingRisks > 0) return;

  // 1. Create Demo Assets
  const assets = await Asset.create([
    {
      organizationId: ctx.organizationId,
      name: "Student Database",
      type: "Database",
      confidentiality: 5,
      integrity: 5,
      availability: 4,
      owner: "Database Admin",
    },
    {
      organizationId: ctx.organizationId,
      name: "Examination Server",
      type: "Server",
      confidentiality: 4,
      integrity: 5,
      availability: 5,
      owner: "Exam Cell",
    },
    {
      organizationId: ctx.organizationId,
      name: "Student Portal",
      type: "Web Application",
      confidentiality: 3,
      integrity: 4,
      availability: 4,
      owner: "Webmaster",
    },
    {
      organizationId: ctx.organizationId,
      name: "Faculty Laptops",
      type: "Laptop",
      confidentiality: 3,
      integrity: 3,
      availability: 3,
      owner: "IT Support",
    },
    {
      organizationId: ctx.organizationId,
      name: "Faculty Equipment",
      type: "Physical Equipment",
      confidentiality: 3,
      integrity: 3,
      availability: 3,
      owner: "IT Support",
    },
    {
      organizationId: ctx.organizationId,
      name: "College Website",
      type: "Web Application",
      confidentiality: 1,
      integrity: 2,
      availability: 4,
      owner: "Public Relations",
    },
    {
      organizationId: ctx.organizationId,
      name: "Email Server",
      type: "Web Application",
      confidentiality: 4,
      integrity: 3,
      availability: 4,
      owner: "SysAdmin",
    },
    {
      organizationId: ctx.organizationId,
      name: "Wi-Fi Network",
      type: "Server",
      confidentiality: 2,
      integrity: 2,
      availability: 3,
      owner: "Network Admin",
    },
  ]);

  const assetMap = new Map<string, string>(
    assets.map((a: { name: string; _id: { toString(): string } }) => [
      a.name,
      a._id.toString(),
    ])
  );

  // 2. Create Demo Risks
  const demoRiskDefs = [
    {
      assetName: "Student Database",
      threatKey: "thr_data_breach",
      vulnerabilityKey: "vul_weak_access_control",
      likelihood: 4,
      impact: 5,
      owner: "Alice Smith",
    },
    {
      assetName: "Examination Server",
      threatKey: "thr_ransomware",
      vulnerabilityKey: "vul_unpatched_software",
      likelihood: 4,
      impact: 5,
      owner: "Bob Jones",
    },
    {
      assetName: "Student Portal",
      threatKey: "thr_sql_injection",
      vulnerabilityKey: "vul_poor_input_validation",
      likelihood: 3,
      impact: 4,
      owner: "Charlie Brown",
    },
    {
      assetName: "Faculty Laptops",
      threatKey: "thr_malware",
      vulnerabilityKey: "vul_unpatched_software",
      likelihood: 3,
      impact: 3,
      owner: "Diana Prince",
    },
    {
      assetName: "College Website",
      threatKey: "thr_ddos",
      vulnerabilityKey: "vul_insecure_api",
      likelihood: 4,
      impact: 4,
      owner: "Evan Wright",
    },
    {
      assetName: "Faculty Equipment",
      threatKey: "thr_hardware_theft",
      vulnerabilityKey: "vul_no_physical_access_control",
      likelihood: 2,
      impact: 4,
      owner: "Fiona Gallagher",
    },
    {
      assetName: "Email Server",
      threatKey: "thr_phishing",
      vulnerabilityKey: "vul_weak_authentication",
      likelihood: 4,
      impact: 3,
      owner: "George Clark",
    },
    {
      assetName: "Wi-Fi Network",
      threatKey: "thr_brute_force",
      vulnerabilityKey: "vul_weak_authentication",
      likelihood: 3,
      impact: 2,
      owner: "Hannah Abbott",
    },
  ];

  for (const def of demoRiskDefs) {
    const assetId = assetMap.get(def.assetName);
    if (!assetId) continue;
    await riskService.createRisk(ctx, {
      assetId: String(assetId),
      threatKey: def.threatKey,
      vulnerabilityKey: def.vulnerabilityKey,
      likelihood: def.likelihood,
      impact: def.impact,
      owner: def.owner,
    });
  }
}

export async function seedDemoTreatments(ctx: SeedCtx) {
  // Idempotent: only run if organization has ZERO Assessment documents
  const count = await Assessment.countDocuments({
    organizationId: ctx.organizationId,
  });
  if (count > 0) return;

  const now = new Date();

  // Helper to find risk by asset name + threat name
  const findRisk = async (assetName: string, threatName: string) => {
    const risks = await riskService.listRisks(ctx, {
      basis: "inherent",
      page: 1,
      limit: 100,
      sort: "riskId",
      order: "asc",
    });
    return risks.items.find(
      (r) =>
        r.asset.name.toLowerCase() === assetName.toLowerCase() &&
        r.threat.name.toLowerCase() === threatName.toLowerCase()
    );
  };

  // 1. Snapshot S1: Initial assessment (60 days ago)
  const d60 = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  await assessmentService.createAssessment(
    ctx,
    { label: "Initial assessment" },
    { asOf: d60 }
  );

  // 2. Stage 1 Treatments
  const rStudentDb1 = await findRisk("Student Database", "Data Breach");
  if (rStudentDb1) {
    await riskService.setRiskControls(ctx, rStudentDb1.riskId, {
      controls: [
        { controlKey: "ctl_rbac", status: "implemented" },
        { controlKey: "ctl_mfa", status: "implemented" },
        { controlKey: "ctl_access_monitoring", status: "planned" },
        { controlKey: "ctl_db_encryption", status: "planned" },
      ],
      expectedUpdatedAt: rStudentDb1.updatedAt,
    });
  }

  const rExamServer1 = await findRisk("Examination Server", "Ransomware");
  if (rExamServer1) {
    await riskService.setRiskControls(ctx, rExamServer1.riskId, {
      controls: [
        { controlKey: "ctl_edr", status: "implemented" },
        { controlKey: "ctl_offline_backup", status: "planned" },
      ],
      expectedUpdatedAt: rExamServer1.updatedAt,
    });
  }

  const rStudentPortal1 = await findRisk("Student Portal", "SQL Injection");
  if (rStudentPortal1) {
    await riskService.setRiskControls(ctx, rStudentPortal1.riskId, {
      controls: [{ controlKey: "ctl_patch_management", status: "planned" }],
      expectedUpdatedAt: rStudentPortal1.updatedAt,
    });
  }

  // 3. Snapshot S2: After first treatments (30 days ago)
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  await assessmentService.createAssessment(
    ctx,
    { label: "After first treatments" },
    { asOf: d30 }
  );

  // 4. Stage 2 Treatments
  const rStudentDb2 = await findRisk("Student Database", "Data Breach");
  if (rStudentDb2) {
    await riskService.setRiskControls(ctx, rStudentDb2.riskId, {
      controls: [
        { controlKey: "ctl_rbac", status: "implemented" },
        { controlKey: "ctl_mfa", status: "implemented" },
        { controlKey: "ctl_access_monitoring", status: "implemented" },
        { controlKey: "ctl_db_encryption", status: "implemented" },
      ],
      expectedUpdatedAt: rStudentDb2.updatedAt,
    });
  }

  const rExamServer2 = await findRisk("Examination Server", "Ransomware");
  if (rExamServer2) {
    await riskService.setRiskControls(ctx, rExamServer2.riskId, {
      controls: [
        { controlKey: "ctl_edr", status: "implemented" },
        { controlKey: "ctl_offline_backup", status: "implemented" },
        { controlKey: "ctl_patch_management", status: "implemented" },
        { controlKey: "ctl_network_segmentation", status: "planned" },
      ],
      expectedUpdatedAt: rExamServer2.updatedAt,
    });
  }

  const rFacultyMalware = await findRisk("Faculty Laptops", "Malware");
  if (rFacultyMalware) {
    await riskService.setRiskControls(ctx, rFacultyMalware.riskId, {
      controls: [{ controlKey: "ctl_edr", status: "implemented" }],
      expectedUpdatedAt: rFacultyMalware.updatedAt,
    });
  }

  const rCollegeDdos = await findRisk(
    "College Website",
    "Distributed Denial of Service (DDoS)"
  );
  if (rCollegeDdos) {
    await riskService.setRiskTreatment(
      ctx,
      rCollegeDdos.riskId,
      {
        treatment: "transfer",
        justification: "Managed DDoS protection included in the ISP contract.",
        transferFactor: 0.4,
        expectedUpdatedAt: rCollegeDdos.updatedAt,
      },
      "admin"
    );
  }

  const rFacultyTheft = await findRisk("Faculty Equipment", "Hardware Theft");
  if (rFacultyTheft) {
    const revDate = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);
    const y = revDate.getUTCFullYear();
    const m = String(revDate.getUTCMonth() + 1).padStart(2, "0");
    const d = String(revDate.getUTCDate()).padStart(2, "0");

    await riskService.setRiskTreatment(
      ctx,
      rFacultyTheft.riskId,
      {
        treatment: "accept",
        justification:
          "Cost of mitigation exceeds expected loss; devices are encrypted and insured.",
        approver: "Head of IT",
        reviewDate: `${y}-${m}-${d}`,
        expectedUpdatedAt: rFacultyTheft.updatedAt,
      },
      "admin"
    );
  }

  // 5. Snapshot S3: Current state
  await assessmentService.createAssessment(
    ctx,
    { label: "Current state" },
    { asOf: now }
  );
}

export async function runSeed(
  ctx: SeedCtx = { organizationId: "org_default", actorId: "admin" }
) {
  await seedLibrary();
  await seedDemoRisks(ctx);
  await seedDemoTreatments(ctx);
}

// CLI runner for `npm run seed`
async function main() {
  const uri = (process.env.MONGODB_URI && process.env.MONGODB_URI !== "placeholder_uri")
    ? process.env.MONGODB_URI
    : "mongodb://127.0.0.1:27017/srmp";

  console.log(`[Seed] Connecting to MongoDB at ${uri}...`);
  await mongoose.connect(uri);
  console.log("[Seed] Connected. Populating library, assets, risks, treatments, and snapshots...");
  await runSeed();
  console.log("[Seed] Seeding completed successfully!");
  await mongoose.disconnect();
}

if (!process.env.VITEST && (process.argv[1]?.endsWith("seed.ts") || process.argv[1]?.includes("seed"))) {
  main().catch((err) => {
    console.error("[Seed] Error during seeding:", err);
    process.exit(1);
  });
}

