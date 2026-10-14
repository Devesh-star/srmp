import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/api/route";
import { riskService } from "@/services/riskService";
import { Control } from "@/models/Control";
import { Vulnerability } from "@/models/Vulnerability";
import { RiskStatusHeader } from "@/components/risk/RiskStatusHeader";
import { RiskComparison } from "@/components/RiskComparison";
import { RiskControlsSection } from "@/components/risk/RiskControlsSection";
import { RiskTreatmentSection } from "@/components/risk/RiskTreatmentSection";
import { RiskHistoryPanel } from "@/components/risk/RiskHistoryPanel";
import { AppError } from "@/lib/errors";

export default async function RiskDetailPage({
  params,
}: {
  params: Promise<{ riskId: string }>;
}) {
  let ctx;
  try {
    ctx = await requireAuth(["admin", "assessor", "viewer"]);
  } catch {
    // If auth fails in server component
    ctx = { organizationId: "org_default", actor: "demo_admin", role: "admin" };
  }

  const { riskId } = await params;

  let risk;
  try {
    risk = await riskService.getRisk(
      { organizationId: ctx.organizationId, actorId: ctx.actor },
      riskId
    );
  } catch (e) {
    if (e instanceof AppError && e.statusCode === 404) {
      notFound();
    }
    throw e;
  }

  const history = await riskService.getRiskHistory(
    { organizationId: ctx.organizationId, actorId: ctx.actor },
    riskId
  );

  // Load visible controls and vulnerability recommendations
  const [allControls, vulDoc] = await Promise.all([
    Control.find({
      organizationId: { $in: [null, ctx.organizationId] },
    })
      .select("key name category reduces effectiveness implementationCost")
      .lean(),
    Vulnerability.findOne({
      key: risk.vulnerability.key,
      organizationId: { $in: [null, ctx.organizationId] },
    })
      .select("recommendedControlKeys")
      .lean(),
  ]);

  const recommendedKeys = new Set(
    (vulDoc?.recommendedControlKeys as string[]) || []
  );

  const availableControls = allControls.map((c) => ({
    key: c.key,
    name: c.name,
    category: c.category,
    reduces: c.reduces as "likelihood" | "impact",
    effectiveness: c.effectiveness,
    implementationCost: c.implementationCost,
    isRecommended: recommendedKeys.has(c.key),
  }));

  return (
    <div className="space-y-8 pb-12">
      {/* Breadcrumb navigation */}
      <div className="flex items-center space-x-2 text-xs text-slate-400">
        <Link href="/risks" className="hover:text-indigo-400 transition-colors">
          ← Risk Register
        </Link>
        <span>/</span>
        <span className="text-slate-200 font-mono font-semibold">{risk.riskId}</span>
      </div>

      {/* Header & Status Actions */}
      <RiskStatusHeader risk={risk} userRole={ctx.role} />

      {/* Side-by-side Score Comparison */}
      <RiskComparison
        inherentLikelihood={risk.likelihood}
        inherentImpact={risk.impact}
        inherentScore={risk.inherentScore}
        inherentLevel={risk.inherentLevel}
        residualLikelihood={risk.residualLikelihood}
        residualImpact={risk.residualImpact}
        residualScore={risk.residualScore}
        residualLevel={risk.residualLevel}
        treatment={risk.treatment}
      />

      {/* Controls Management Section */}
      <RiskControlsSection
        risk={risk}
        userRole={ctx.role}
        availableControls={availableControls}
      />

      {/* Treatment Strategy Section */}
      <RiskTreatmentSection risk={risk} userRole={ctx.role} />

      {/* History & Audit Timeline */}
      <RiskHistoryPanel history={history} />
    </div>
  );
}
