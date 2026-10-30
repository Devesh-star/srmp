import mongoose from "mongoose";
import { Risk } from "@/models/Risk";
import { Asset } from "@/models/Asset";
import { Assessment } from "@/models/Assessment";
import { AuditLog } from "@/models/AuditLog";
import { Counter } from "@/models/Counter";
import { seedLibrary } from "@/scripts/seed";

export async function clearDemoData(organizationId: string = "org_default") {
  console.log(`[Clear] Removing demo data for organization: ${organizationId}...`);

  const [delRisks, delAssets, delAssessments, delAudit, delCounters] = await Promise.all([
    Risk.deleteMany({ organizationId }),
    Asset.deleteMany({ organizationId }),
    Assessment.deleteMany({ organizationId }),
    AuditLog.deleteMany({ organizationId }),
    Counter.deleteMany({ organizationId }),
  ]);

  console.log(`[Clear] Removed:`);
  console.log(`  - Risks: ${delRisks.deletedCount}`);
  console.log(`  - Assets: ${delAssets.deletedCount}`);
  console.log(`  - Assessment Snapshots: ${delAssessments.deletedCount}`);
  console.log(`  - Audit Logs: ${delAudit.deletedCount}`);
  console.log(`  - Sequence Counters: ${delCounters.deletedCount}`);

  // Ensure library catalogs (threats, vulnerabilities, controls) remain intact
  console.log("[Clear] Ensuring global cybersecurity library catalogs are intact...");
  await seedLibrary();
  console.log("[Clear] Library ready for new custom risk assessments!");
}

async function main() {
  const uri = (process.env.MONGODB_URI && process.env.MONGODB_URI !== "placeholder_uri")
    ? process.env.MONGODB_URI
    : "mongodb://127.0.0.1:27017/srmp";

  console.log(`[Clear] Connecting to MongoDB at ${uri}...`);
  await mongoose.connect(uri);

  await clearDemoData("org_default");

  console.log("[Clear] Database cleared successfully. You can now enter assets and perform fresh assessments.");
  await mongoose.disconnect();
}

if (!process.env.VITEST && (process.argv[1]?.endsWith("clear.ts") || process.argv[1]?.includes("clear"))) {
  main().catch((err) => {
    console.error("[Clear] Error clearing database:", err);
    process.exit(1);
  });
}
