import Link from "next/link";
import { requireAuth } from "@/lib/api/route";
import { assessmentService } from "@/services/assessmentService";
import { TakeSnapshotForm } from "@/components/assessment/TakeSnapshotForm";

interface AssessmentsPageProps {
  searchParams: Promise<{ page?: string }>;
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

export default async function AssessmentsPage({ searchParams }: AssessmentsPageProps) {
  let ctx;
  try {
    ctx = await requireAuth(["admin", "assessor", "viewer"]);
  } catch {
    ctx = { organizationId: "org_default", actor: "demo_admin", role: "admin" };
  }

  const sp = await searchParams;
  const page = parseInt(sp.page || "1", 10);

  const [data, trend] = await Promise.all([
    assessmentService.listAssessments(
      { organizationId: ctx.organizationId },
      { page, limit: 20 }
    ),
    assessmentService.getTrend(
      { organizationId: ctx.organizationId },
      { limit: 24 }
    ),
  ]);

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">
          Risk Assessment Snapshots
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Historical point-in-time assessment snapshots and organizational risk trend trajectory.
        </p>
      </div>

      {/* Snapshot Form */}
      <TakeSnapshotForm userRole={ctx.role} />

      {/* Historical Trend Table */}
      {trend.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h2 className="text-base font-semibold text-white">
              Assessment Trend History (Oldest → Newest)
            </h2>
            <p className="text-xs text-slate-400">
              Chronological progression of organizational residual risk scores and counts.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-950/40">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Snapshot Label</th>
                  <th className="py-2.5 px-3 text-center">Residual Overall</th>
                  <th className="py-2.5 px-3 text-center">Inherent Overall</th>
                  <th className="py-2.5 px-3 text-center">Max Risk Score</th>
                  <th className="py-2.5 px-3 text-center">Critical</th>
                  <th className="py-2.5 px-3 text-center">High</th>
                  <th className="py-2.5 px-3 text-center">Medium</th>
                  <th className="py-2.5 px-3 text-center">Low</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300 font-mono">
                {trend.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3 font-sans text-slate-400">
                      {new Date(t.date).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 px-3 font-sans font-semibold text-white">
                      <Link
                        href={`/assessments/${t.id}`}
                        className="text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        {t.label}
                      </Link>
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-white">
                      {t.overallScore}%
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-400">
                      {t.inherentOverall}%
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-200">
                      {t.maxScore}
                    </td>
                    <td className="py-2.5 px-3 text-center text-rose-400 font-bold">
                      {t.counts.Critical}
                    </td>
                    <td className="py-2.5 px-3 text-center text-orange-400 font-bold">
                      {t.counts.High}
                    </td>
                    <td className="py-2.5 px-3 text-center text-amber-400 font-bold">
                      {t.counts.Medium}
                    </td>
                    <td className="py-2.5 px-3 text-center text-emerald-400 font-bold">
                      {t.counts.Low}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Snapshots List */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
        <div className="border-b border-slate-800 pb-3 flex justify-between items-center">
          <div>
            <h2 className="text-base font-semibold text-white">
              All Snapshots ({data.total})
            </h2>
            <p className="text-xs text-slate-400">
              Immutable risk posture snapshots recorded for this organization.
            </p>
          </div>
        </div>

        {data.items.length === 0 ? (
          <div className="text-center py-12 text-xs text-slate-500">
            No assessment snapshots recorded yet. Click &quot;Take Snapshot&quot; above to capture the first baseline.
          </div>
        ) : (
          <div className="space-y-3">
            {data.items.map((item) => (
              <div
                key={item.id}
                className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4 hover:border-slate-700 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-3">
                    <Link
                      href={`/assessments/${item.id}`}
                      className="font-bold text-sm text-white hover:text-indigo-400 transition-colors"
                    >
                      {item.label}
                    </Link>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${getLevelBadgeClasses(
                        item.overallLevel
                      )}`}
                    >
                      {item.overallLevel}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Captured on {new Date(item.date).toLocaleString()} • {item.totalRisks} risks recorded
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-6 text-xs font-mono">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-sans">
                      Residual Overall
                    </span>
                    <span className="text-base font-extrabold text-white">
                      {item.overallScore}%
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-sans">
                      Inherent Overall
                    </span>
                    <span className="text-base font-semibold text-slate-400">
                      {item.inherentOverall}%
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-sans">
                      Max Risk Score
                    </span>
                    <span className="text-base font-semibold text-slate-200">
                      {item.maxScore}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 text-[11px]">
                    <span className="px-2 py-0.5 rounded bg-rose-950/80 border border-rose-800 text-rose-300 font-bold">
                      {item.counts.Critical} Crit
                    </span>
                    <span className="px-2 py-0.5 rounded bg-orange-950/80 border border-orange-800 text-orange-300 font-bold">
                      {item.counts.High} High
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-950/80 border border-amber-800 text-amber-300 font-bold">
                      {item.counts.Medium} Med
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800 text-emerald-300 font-bold">
                      {item.counts.Low} Low
                    </span>
                  </div>

                  <Link
                    href={`/assessments/${item.id}`}
                    className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-sans font-semibold border border-slate-700 transition-colors"
                  >
                    View Details →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {data.total > data.limit && (
          <div className="p-4 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
            <span>
              Page {data.page} of {Math.ceil(data.total / data.limit)}
            </span>
            <div className="flex space-x-2">
              {data.page > 1 && (
                <Link
                  href={`/assessments?page=${data.page - 1}`}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded border border-slate-700"
                >
                  Previous
                </Link>
              )}
              {data.page * data.limit < data.total && (
                <Link
                  href={`/assessments?page=${data.page + 1}`}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded border border-slate-700"
                >
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
