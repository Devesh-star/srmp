import Link from "next/link";
import { requireAuth } from "@/lib/api/route";
import { connectDB } from "@/lib/db";
import { dashboardService } from "@/services/dashboardService";
import { matrixService } from "@/services/matrixService";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { RiskDistributionChart } from "@/components/dashboard/RiskDistributionChart";
import { RiskByCategoryChart } from "@/components/dashboard/RiskByCategoryChart";
import { TopRisksChart } from "@/components/dashboard/TopRisksChart";
import { VulnerableAssetsChart } from "@/components/dashboard/VulnerableAssetsChart";
import { InherentVsResidualChart } from "@/components/dashboard/InherentVsResidualChart";
import { ControlImplementationChart } from "@/components/dashboard/ControlImplementationChart";
import { RiskTrendChart } from "@/components/dashboard/RiskTrendChart";
import { RiskMatrix } from "@/components/RiskMatrix";

interface DashboardPageProps {
  searchParams: Promise<{
    basis?: "residual" | "inherent";
  }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  await connectDB();
  let ctx;
  try {
    ctx = await requireAuth(["admin", "assessor", "viewer"]);
  } catch {
    ctx = { organizationId: "org_default", actor: "demo_admin", role: "admin" };
  }

  const sp = await searchParams;
  const basis = sp.basis === "inherent" ? "inherent" : "residual";

  const [dashboardData, matrixData] = await Promise.all([
    dashboardService.getDashboard(
      { organizationId: ctx.organizationId, actorId: ctx.actor },
      { basis }
    ),
    matrixService.getMatrix(
      { organizationId: ctx.organizationId },
      { basis, includeClosed: false }
    ),
  ]);

  const isEmptyOrg =
    dashboardData.totals.assets === 0 &&
    dashboardData.totals.includedRisks === 0 &&
    dashboardData.totals.closedRisks === 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <DashboardHeader
        organizationName="Organization Risk Posture"
        basis={basis}
        generatedAt={dashboardData.generatedAt}
        userRole={ctx.role}
      />

      {isEmptyOrg ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center max-w-xl mx-auto space-y-5 shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-indigo-950/70 border border-indigo-700/50 flex items-center justify-center text-3xl mx-auto">
            🛡️
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Welcome to CyberRisk</h2>
            <p className="text-sm text-slate-400 mt-2">
              Your organization workspace has no assets or risks assessed yet. Get started by adding an asset or recording your first risk scenario.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/assets"
              className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm font-semibold text-white transition-colors"
            >
              Add Assets
            </Link>
            <Link
              href="/risks/new"
              className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-bold text-white shadow-lg transition-colors"
            >
              Assess First Risk
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Hero Row: Overall Risk, Projected, and Metric Cards */}
          <DashboardHero
            basis={basis}
            totals={dashboardData.totals}
            overall={dashboardData.overall}
            projected={dashboardData.projected}
            snapshotComparison={dashboardData.snapshotComparison}
            canTakeSnapshot={ctx.role === "admin" || ctx.role === "assessor"}
          />

          {/* Charts Responsive Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 1. Risk Distribution */}
            <RiskDistributionChart
              distribution={dashboardData.distribution}
              basis={basis}
            />

            {/* 2. Risk by Threat Category */}
            <RiskByCategoryChart
              byCategory={dashboardData.byCategory}
              basis={basis}
            />

            {/* 3. Top 10 Risks */}
            <TopRisksChart
              topRisks={dashboardData.topRisks}
              basis={basis}
            />

            {/* 4. Most Vulnerable Assets */}
            <VulnerableAssetsChart
              vulnerableAssets={dashboardData.vulnerableAssets}
              basis={basis}
            />

            {/* 5. Inherent vs Residual Comparison */}
            <InherentVsResidualChart
              inherentVsResidual={dashboardData.inherentVsResidual}
            />

            {/* 6. Control Implementation Progress */}
            <ControlImplementationChart
              controlImplementation={dashboardData.controlImplementation}
            />

            {/* 7. Risk Posture Trend Over Time */}
            <RiskTrendChart
              trend={dashboardData.trend}
              live={dashboardData.live}
              bandsOverall={dashboardData.bands.overall}
              canTakeSnapshot={ctx.role === "admin" || ctx.role === "assessor"}
            />

            {/* 8. Compact 5x5 Heatmap Matrix */}
            <section
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col justify-between"
              aria-label="Compact Heatmap Matrix"
            >
              <div className="border-b border-slate-800/80 pb-3 mb-4">
                <h3 className="text-sm font-semibold text-white tracking-tight">
                  Risk Heatmap Matrix ({basis})
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  5×5 distribution of active risks across Likelihood and Impact
                </p>
              </div>

              <div className="flex-1">
                <RiskMatrix
                  matrixData={matrixData}
                  basis={basis}
                  compact={true}
                />
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
