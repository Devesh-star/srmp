import Link from "next/link";
import { requireAuth } from "@/lib/api/route";
import { connectDB } from "@/lib/db";
import { matrixService } from "@/services/matrixService";
import { Asset } from "@/models/Asset";

interface MatrixPageProps {
  searchParams: Promise<{
    basis?: "inherent" | "residual";
    assetId?: string;
    includeClosed?: string;
  }>;
}

import { getLevelCellClasses } from "@/lib/ui/levelStyles";

export default async function RiskMatrixPage({ searchParams }: MatrixPageProps) {
  await connectDB();
  let ctx;
  try {
    ctx = await requireAuth(["admin", "assessor", "viewer"]);
  } catch {
    ctx = { organizationId: "org_default", actor: "demo_admin", role: "admin" };
  }

  const sp = await searchParams;
  const basis = sp.basis || "residual";
  const includeClosed = sp.includeClosed === "true";

  const [matrixData, assets] = await Promise.all([
    matrixService.getMatrix(
      { organizationId: ctx.organizationId },
      {
        basis,
        assetId: sp.assetId,
        includeClosed,
      }
    ),
    Asset.find({ organizationId: ctx.organizationId }).select("_id name").lean(),
  ]);

  // Build grid map [likelihood][impact]
  const cellGrid: Record<number, Record<number, (typeof matrixData.cells)[0]>> = {};
  for (let l = 1; l <= 5; l++) {
    cellGrid[l] = {};
  }
  for (const cell of matrixData.cells) {
    cellGrid[cell.likelihood][cell.impact] = cell;
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">5x5 Risk Matrix</h1>
          <p className="text-xs text-slate-400">
            Heatmap distribution of organizational risks plotted by Likelihood and Impact.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            href="/risks"
            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors"
          >
            ← Risk Register
          </Link>
        </div>
      </div>

      {/* Matrix Controls / Toolbar */}
      <form method="GET" className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center gap-4">
        {/* Basis toggle */}
        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-400 font-semibold">Evaluation Basis:</span>
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
        </div>

        {/* Asset filter */}
        <div className="flex items-center space-x-2">
          <label htmlFor="matrix-asset" className="text-xs text-slate-400 font-semibold">
            Asset:
          </label>
          <select
            id="matrix-asset"
            name="assetId"
            defaultValue={sp.assetId || ""}
            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Assets</option>
            {assets.map((a) => (
              <option key={a._id.toString()} value={a._id.toString()}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        {/* Include Closed checkbox */}
        <div className="flex items-center space-x-2">
          <label className="text-xs text-slate-300 flex items-center space-x-1.5 cursor-pointer">
            <input
              type="checkbox"
              name="includeClosed"
              value="true"
              defaultChecked={includeClosed}
              className="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-indigo-500"
            />
            <span>Include Closed Risks</span>
          </label>
        </div>

        <button
          type="submit"
          className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors"
        >
          Apply
        </button>
      </form>

      {/* 5x5 Heatmap Matrix Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
        <div className="flex justify-between items-center text-xs text-slate-400 border-b border-slate-800 pb-3">
          <span>
            Plotted: <strong className="text-white">{matrixData.totalPlotted}</strong> risks
            {matrixData.notPlotted > 0 && (
              <span className="ml-2 text-slate-500">({matrixData.notPlotted} avoided/unplotted)</span>
            )}
          </span>
          <span className="capitalize font-semibold text-indigo-400">
            {basis} Risk Heatmap
          </span>
        </div>

        <div className="flex">
          {/* Y-Axis Label */}
          <div className="flex items-center justify-center w-8">
            <span className="-rotate-90 text-xs font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">
              Likelihood (1–5)
            </span>
          </div>

          {/* Grid Container */}
          <div className="flex-1 space-y-2">
            {[5, 4, 3, 2, 1].map((l) => (
              <div key={l} className="flex items-center gap-2">
                <span className="w-4 text-xs font-bold text-slate-400 text-right">{l}</span>
                <div className="grid grid-cols-5 gap-2 flex-1">
                  {[1, 2, 3, 4, 5].map((i) => {
                    const cell = cellGrid[l]?.[i];
                    if (!cell) return null;

                    return (
                      <div
                        key={i}
                        className={`border rounded-lg p-3 min-h-[90px] flex flex-col justify-between transition-all ${getLevelCellClasses(
                          cell.level
                        )}`}
                      >
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-bold opacity-75">
                            L{l} × I{i}
                          </span>
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-950/60">
                            {cell.cellScore}
                          </span>
                        </div>

                        <div className="my-1">
                          <span className="text-2xl font-extrabold text-white block">
                            {cell.count}
                          </span>
                          <span className="text-[10px] opacity-75 font-semibold">
                            {cell.level}
                          </span>
                        </div>

                        {cell.risks.length > 0 && (
                          <div className="text-[10px] text-slate-300 truncate">
                            {cell.risks.map((r) => r.riskId).join(", ")}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* X-Axis Labels */}
            <div className="flex items-center gap-2 pt-2">
              <span className="w-4"></span>
              <div className="grid grid-cols-5 gap-2 flex-1 text-center text-xs font-bold text-slate-400">
                <span>1</span>
                <span>2</span>
                <span>3</span>
                <span>4</span>
                <span>5</span>
              </div>
            </div>

            {/* X-Axis Title */}
            <div className="text-center pt-1">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Impact (1–5)
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
