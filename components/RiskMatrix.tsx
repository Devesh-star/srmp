"use client";

import React from "react";
import Link from "next/link";
import { MatrixResult, MatrixCell } from "@/services/matrixService";
import { getLevelCellClasses, getLevelBadgeClasses } from "@/lib/ui/levelStyles";

interface RiskMatrixProps {
  matrixData: MatrixResult;
  basis: "inherent" | "residual";
  compact?: boolean;
}

export function RiskMatrix({ matrixData, basis, compact = false }: RiskMatrixProps) {
  // Build grid map [likelihood][impact]
  const cellGrid: Record<number, Record<number, MatrixCell>> = {};
  for (let l = 1; l <= 5; l++) {
    cellGrid[l] = {};
  }
  for (const cell of matrixData.cells) {
    cellGrid[cell.likelihood][cell.impact] = cell;
  }

  const tableData = matrixData.cells
    .filter((c) => c.count > 0)
    .sort((a, b) => b.cellScore - a.cellScore);

  if (compact) {
    return (
      <div className="flex flex-col h-full justify-between" aria-label="Compact 5x5 Risk Heatmap">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>
              <span className="font-bold text-white font-mono">{matrixData.totalPlotted}</span> risks plotted
              {matrixData.notPlotted > 0 && (
                <span className="text-slate-500 ml-1">({matrixData.notPlotted} unplotted)</span>
              )}
            </span>
            <span className="capitalize text-indigo-400 font-semibold">{basis} Heatmap</span>
          </div>

          <div className="flex">
            {/* Y-Axis Label */}
            <div className="flex items-center justify-center w-6">
              <span className="-rotate-90 text-[10px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                Likelihood
              </span>
            </div>

            {/* Grid */}
            <div className="flex-1 space-y-1">
              {[5, 4, 3, 2, 1].map((l) => (
                <div key={l} className="flex items-center gap-1.5">
                  <span className="w-3 text-[10px] font-bold text-slate-400 text-right">{l}</span>
                  <div className="grid grid-cols-5 gap-1.5 flex-1">
                    {[1, 2, 3, 4, 5].map((i) => {
                      const cell = cellGrid[l]?.[i];
                      if (!cell) return null;
                      return (
                        <div
                          key={i}
                          className={`border rounded p-1.5 min-h-[46px] flex flex-col justify-between transition-colors ${getLevelCellClasses(
                            cell.level
                          )}`}
                          title={`L${l} × I${i} (Score: ${cell.cellScore}) - ${cell.count} risks`}
                        >
                          <div className="flex justify-between items-center text-[9px] font-bold opacity-75">
                            <span>L{l}I{i}</span>
                            <span className="font-mono">{cell.cellScore}</span>
                          </div>
                          <div className="text-right">
                            <span
                              className={`text-sm font-extrabold font-mono ${
                                cell.count > 0 ? "text-white" : "text-slate-600"
                              }`}
                            >
                              {cell.count}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* X-Axis */}
              <div className="flex items-center gap-1.5 pt-1">
                <span className="w-3"></span>
                <div className="grid grid-cols-5 gap-1.5 flex-1 text-center text-[10px] font-bold text-slate-400">
                  <span>1</span>
                  <span>2</span>
                  <span>3</span>
                  <span>4</span>
                  <span>5</span>
                </div>
              </div>
              <div className="text-center text-[10px] font-bold uppercase tracking-wider text-slate-400 pt-0.5">
                Impact (1–5)
              </div>
            </div>
          </div>
        </div>

        <div className="pt-3 flex items-center justify-between border-t border-slate-800/80 mt-2">
          <Link
            href={`/risks/matrix?basis=${basis}`}
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1"
          >
            Open Interactive 5×5 Matrix →
          </Link>
        </div>

        {/* Accessible Table */}
        <details className="mt-2 text-xs text-slate-400 group">
          <summary className="cursor-pointer font-medium hover:text-slate-200 focus:outline-none rounded py-0.5 inline-block">
            ▶ View heatmap cells as table
          </summary>
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-left border-collapse text-xs">
              <caption className="sr-only">Active risk counts per 5x5 heatmap cell</caption>
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                  <th scope="col" className="py-1 px-2">Cell</th>
                  <th scope="col" className="py-1 px-2">Score</th>
                  <th scope="col" className="py-1 px-2">Level</th>
                  <th scope="col" className="py-1 px-2">Risks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {tableData.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-2 px-2 text-slate-500 text-center">
                      No active plotted risks
                    </td>
                  </tr>
                ) : (
                  tableData.map((c) => (
                    <tr key={`${c.likelihood}-${c.impact}`} className="hover:bg-slate-800/30">
                      <td className="py-1 px-2 font-mono text-slate-300">
                        L{c.likelihood} × I{c.impact}
                      </td>
                      <td className="py-1 px-2 font-mono text-white">{c.cellScore}</td>
                      <td className="py-1 px-2">
                        <span className={`px-1.5 py-0.2 rounded text-[10px] border font-medium ${getLevelBadgeClasses(c.level)}`}>
                          {c.level}
                        </span>
                      </td>
                      <td className="py-1 px-2 font-mono font-bold text-white">{c.count}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    );
  }

  // Full matrix rendering is handled in app/risks/matrix/page.tsx
  return null;
}
