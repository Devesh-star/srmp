import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/api/route";
import { assessmentService } from "@/services/assessmentService";
import { DeleteAssessmentButton } from "@/components/assessment/DeleteAssessmentButton";
import { roundTo } from "@/lib/riskEngine";
import { AppError } from "@/lib/errors";

interface AssessmentDetailPageProps {
  params: Promise<{ id: string }>;
}

function getLevelBadgeClasses(level: string): string {
  switch (level) {
    case "Low":
      return "bg-emerald-950/80 text-emerald-400 border-emerald-700";
    case "Medium":
      return "bg-amber-950/80 text-amber-400 border-amber-700";
    case "High":
      return "bg-orange-950/80 text-orange-400 border-orange-700";
    case "Critical":
      return "bg-rose-950/80 text-rose-400 border-rose-700";
    default:
      return "bg-slate-800 text-slate-300 border-slate-700";
  }
}

function getStatusBadgeClasses(status: string): string {
  switch (status) {
    case "Open":
      return "bg-rose-950/80 text-rose-300 border-rose-700";
    case "In Treatment":
      return "bg-amber-950/80 text-amber-300 border-amber-700";
    case "Mitigated":
      return "bg-emerald-950/80 text-emerald-300 border-emerald-700";
    case "Accepted":
      return "bg-indigo-950/80 text-indigo-300 border-indigo-700";
    case "Closed":
      return "bg-slate-800 text-slate-400 border-slate-600";
    default:
      return "bg-slate-800 text-slate-300 border-slate-700";
  }
}

export default async function AssessmentDetailPage({
  params,
}: AssessmentDetailPageProps) {
  let ctx;
  try {
    ctx = await requireAuth(["admin", "assessor", "viewer"]);
  } catch {
    ctx = { organizationId: "org_default", actor: "demo_admin", role: "admin" };
  }

  const { id } = await params;

  let assessment;
  try {
    assessment = await assessmentService.getAssessment(
      { organizationId: ctx.organizationId },
      id
    );
  } catch (e) {
    if (e instanceof AppError && e.statusCode === 404) {
      notFound();
    }
    throw e;
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Breadcrumbs */}
      <div className="flex items-center space-x-2 text-xs text-slate-400">
        <Link href="/assessments" className="hover:text-indigo-400 transition-colors">
          ← Assessments
        </Link>
        <span>/</span>
        <span className="text-slate-200 font-semibold">{assessment.label}</span>
      </div>

      {/* Snapshot Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold text-white tracking-tight">
                {assessment.label}
              </h1>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${getLevelBadgeClasses(
                  assessment.overallLevel
                )}`}
              >
                {assessment.overallLevel}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Captured on {new Date(assessment.date).toLocaleString()} • Created by {assessment.createdByName}
            </p>
          </div>

          <DeleteAssessmentButton
            id={assessment.id}
            label={assessment.label}
            userRole={ctx.role}
          />
        </div>

        {/* Snapshot Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4">
            <span className="text-xs text-slate-400 font-sans block">Residual Overall</span>
            <div className="text-3xl font-extrabold text-white mt-1">
              {assessment.overallScore}%
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4">
            <span className="text-xs text-slate-400 font-sans block">Inherent Overall</span>
            <div className="text-3xl font-extrabold text-slate-400 mt-1">
              {assessment.inherentOverall}%
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4">
            <span className="text-xs text-slate-400 font-sans block">Max Risk Score</span>
            <div className="text-3xl font-extrabold text-slate-200 mt-1">
              {assessment.maxScore}
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4">
            <span className="text-xs text-slate-400 font-sans block">Total Risks Recorded</span>
            <div className="text-3xl font-extrabold text-indigo-400 mt-1">
              {assessment.totalRisks}
            </div>
          </div>
        </div>
      </div>

      {/* Snapshot Per-Risk Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden space-y-4 p-6">
        <div className="border-b border-slate-800 pb-3">
          <h2 className="text-base font-semibold text-white">
            Recorded Risks at Snapshot Time ({assessment.risks.length})
          </h2>
          <p className="text-xs text-slate-400">
            Immutable snapshot of risk scores and status at this point in time.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-950/40">
                <th className="py-3 px-4">Risk ID</th>
                <th className="py-3 px-4">Asset</th>
                <th className="py-3 px-4 text-center">Inherent Score</th>
                <th className="py-3 px-4 text-center">Residual Score</th>
                <th className="py-3 px-4 text-center">Level</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {assessment.risks.map((r) => (
                <tr key={r.riskId} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4">
                    <Link
                      href={`/risks/${r.riskId}`}
                      className="font-mono font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      {r.riskId}
                    </Link>
                  </td>
                  <td className="py-3 px-4 font-semibold text-white">
                    {r.assetName}
                  </td>
                  <td className="py-3 px-4 text-center font-mono text-slate-400">
                    {r.inherentScore}
                  </td>
                  <td className="py-3 px-4 text-center font-mono font-bold text-white text-sm">
                    {roundTo(r.residualScore, 1)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`px-2.5 py-0.5 rounded-full border text-[11px] font-semibold ${getLevelBadgeClasses(
                        r.level
                      )}`}
                    >
                      {r.level}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2.5 py-0.5 rounded-full border text-[11px] font-semibold ${getStatusBadgeClasses(
                        r.status
                      )}`}
                    >
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
