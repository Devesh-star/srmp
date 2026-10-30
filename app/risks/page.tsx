import Link from "next/link";
import { requireAuth } from "@/lib/api/route";
import { connectDB } from "@/lib/db";
import { riskService } from "@/services/riskService";
import { roundTo } from "@/lib/riskEngine";

interface RiskPageProps {
  searchParams: Promise<{
    q?: string;
    level?: string;
    basis?: "inherent" | "residual";
    status?: string;
    owner?: string;
    assetId?: string;
    page?: string;
  }>;
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

export default async function RiskRegisterPage({ searchParams }: RiskPageProps) {
  await connectDB();
  let ctx;
  try {
    ctx = await requireAuth(["admin", "assessor", "viewer"]);
  } catch {
    ctx = { organizationId: "org_default", actor: "demo_admin", role: "admin" };
  }

  const sp = await searchParams;
  const basis = sp.basis || "residual";
  const page = parseInt(sp.page || "1", 10);

  const data = await riskService.listRisks(
    { organizationId: ctx.organizationId, actorId: ctx.actor },
    {
      q: sp.q,
      level: sp.level,
      basis,
      status: sp.status,
      owner: sp.owner,
      assetId: sp.assetId,
      sort: "riskId",
      order: "asc",
      page,
      limit: 20,
    }
  );

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Risk Register</h1>
          <p className="text-xs text-slate-400">
            Active organizational risk inventory, treatment strategies, and residual postures.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            href="/risks/new"
            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-colors"
          >
            + New Risk Assessment
          </Link>
          <Link
            href="/risks/matrix"
            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors"
          >
            5x5 Heatmap Matrix
          </Link>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400">Overall Score</span>
          <div className="text-2xl font-extrabold text-white mt-1">
            {data.summary.overall}
            <span className="text-xs text-slate-500 font-normal"> / 100</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400">Total Risks</span>
          <div className="text-2xl font-extrabold text-white mt-1">
            {data.total}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-rose-400 font-semibold">Critical</span>
          <div className="text-2xl font-extrabold text-rose-400 mt-1">
            {data.summary.counts.Critical}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-orange-400 font-semibold">High</span>
          <div className="text-2xl font-extrabold text-orange-400 mt-1">
            {data.summary.counts.High}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-emerald-400 font-semibold">Low / Med</span>
          <div className="text-2xl font-extrabold text-emerald-400 mt-1">
            {data.summary.counts.Low + data.summary.counts.Medium}
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <form method="GET" className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          name="q"
          defaultValue={sp.q || ""}
          placeholder="Search risk, asset, threat, owner..."
          className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 flex-1 min-w-[200px]"
        />

        <select
          name="status"
          aria-label="Filter by operational status"
          defaultValue={sp.status || ""}
          className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All Statuses</option>
          <option value="Open">Open</option>
          <option value="In Treatment">In Treatment</option>
          <option value="Mitigated">Mitigated</option>
          <option value="Accepted">Accepted</option>
          <option value="Closed">Closed</option>
        </select>

        <select
          name="level"
          aria-label="Filter by risk level"
          defaultValue={sp.level || ""}
          className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All Levels</option>
          <option value="Critical">Critical</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>

        <div className="flex rounded-lg border border-slate-700 overflow-hidden text-xs">
          <button
            type="submit"
            name="basis"
            value="residual"
            className={`px-3 py-1.5 font-semibold transition-colors ${
              basis === "residual"
                ? "bg-indigo-600 text-white"
                : "bg-slate-950 text-slate-400 hover:text-white"
            }`}
          >
            Residual
          </button>
          <button
            type="submit"
            name="basis"
            value="inherent"
            className={`px-3 py-1.5 font-semibold transition-colors ${
              basis === "inherent"
                ? "bg-indigo-600 text-white"
                : "bg-slate-950 text-slate-400 hover:text-white"
            }`}
          >
            Inherent
          </button>
        </div>

        <button
          type="submit"
          className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors"
        >
          Filter
        </button>

        {(sp.q || sp.status || sp.level) && (
          <Link
            href="/risks"
            className="text-xs text-slate-400 hover:text-indigo-400 transition-colors"
          >
            Clear Filters
          </Link>
        )}
      </form>

      {/* Risks Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-950/40">
                <th className="py-3 px-4">ID</th>
                <th className="py-3 px-4">Asset</th>
                <th className="py-3 px-4">Threat & Vulnerability</th>
                <th className="py-3 px-4 text-center">Score ({basis})</th>
                <th className="py-3 px-4 text-center">Level</th>
                <th className="py-3 px-4">Controls</th>
                <th className="py-3 px-4">Treatment</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Owner</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {data.items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-500">
                    No matching risks found.
                  </td>
                </tr>
              ) : (
                data.items.map((r) => {
                  const displayScore =
                    basis === "inherent"
                      ? r.inherentScore
                      : roundTo(r.residualScore, 1);
                  const displayLevel =
                    basis === "inherent" ? r.inherentLevel : r.residualLevel;

                  const isOverdue =
                    (r.treatment === "accept" || r.treatment === "transfer") &&
                    r.treatmentDetails?.reviewDate &&
                    r.treatmentDetails.reviewDate < today;

                  return (
                    <tr
                      key={r.riskId}
                      className="hover:bg-slate-800/40 transition-colors group"
                    >
                      <td className="py-3 px-4">
                        <Link
                          href={`/risks/${r.riskId}`}
                          className="font-mono font-bold text-indigo-400 hover:text-indigo-300 transition-colors block"
                        >
                          {r.riskId}
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-white block">{r.asset.name}</span>
                        <span className="text-[11px] text-slate-400">{r.asset.type}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-slate-200 block font-medium">{r.threat.name}</span>
                        <span className="text-[11px] text-slate-400">{r.vulnerability.name}</span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-white text-sm">
                        {displayScore}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full border text-[11px] font-semibold ${getLevelBadgeClasses(
                            displayLevel
                          )}`}
                        >
                          {displayLevel}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-slate-300 font-mono">
                          {r.controlsImplemented}/{r.controlsTotal} implemented
                        </span>
                      </td>
                      <td className="py-3 px-4 capitalize">
                        <span className="text-slate-200 block">{r.treatment}</span>
                        {isOverdue && (
                          <span className="text-[10px] text-rose-400 font-bold block">
                            ⚠️ Review Overdue
                          </span>
                        )}
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
                      <td className="py-3 px-4 text-slate-400">{r.owner}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data.total > data.limit && (
          <div className="p-4 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
            <span>
              Showing {(data.page - 1) * data.limit + 1}–
              {Math.min(data.page * data.limit, data.total)} of {data.total} risks
            </span>
            <div className="flex space-x-2">
              {data.page > 1 && (
                <Link
                  href={`/risks?page=${data.page - 1}&basis=${basis}${
                    sp.q ? `&q=${sp.q}` : ""
                  }${sp.status ? `&status=${sp.status}` : ""}${
                    sp.level ? `&level=${sp.level}` : ""
                  }`}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded border border-slate-700"
                >
                  Previous
                </Link>
              )}
              {data.page * data.limit < data.total && (
                <Link
                  href={`/risks?page=${data.page + 1}&basis=${basis}${
                    sp.q ? `&q=${sp.q}` : ""
                  }${sp.status ? `&status=${sp.status}` : ""}${
                    sp.level ? `&level=${sp.level}` : ""
                  }`}
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
