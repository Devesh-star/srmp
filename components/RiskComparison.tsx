"use client";

import React from "react";
import { roundTo } from "@/lib/riskEngine";

interface RiskComparisonProps {
  inherentLikelihood: number;
  inherentImpact: number;
  inherentScore: number;
  inherentLevel: string;

  residualLikelihood: number;
  residualImpact: number;
  residualScore: number;
  residualLevel: string;

  treatment: string;
}

function getLevelBadgeClasses(level: string): { bg: string; text: string; border: string } {
  switch (level) {
    case "Low":
      return { bg: "bg-emerald-950/80", text: "text-emerald-400", border: "border-emerald-700" };
    case "Medium":
      return { bg: "bg-amber-950/80", text: "text-amber-400", border: "border-amber-700" };
    case "High":
      return { bg: "bg-orange-950/80", text: "text-orange-400", border: "border-orange-700" };
    case "Critical":
      return { bg: "bg-rose-950/80", text: "text-rose-400", border: "border-rose-700" };
    default:
      return { bg: "bg-slate-800", text: "text-slate-300", border: "border-slate-600" };
  }
}

export function RiskComparison({
  inherentLikelihood,
  inherentImpact,
  inherentScore,
  inherentLevel,
  residualLikelihood,
  residualImpact,
  residualScore,
  residualLevel,
  treatment,
}: RiskComparisonProps) {
  const roundedInherent = roundTo(inherentScore, 1);
  const roundedResidual = roundTo(residualScore, 1);

  const deltaScore = roundTo(Math.max(0, inherentScore - residualScore), 1);
  const deltaPercent =
    inherentScore > 0
      ? Math.round(((inherentScore - residualScore) / inherentScore) * 100)
      : 0;

  const inherentBadge = getLevelBadgeClasses(inherentLevel);
  const residualBadge = getLevelBadgeClasses(residualLevel);

  const inherentPercent = Math.min(100, Math.round((inherentScore / 25) * 100));
  const residualPercent = Math.min(100, Math.round((residualScore / 25) * 100));

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Risk Score Comparison</h2>
          <p className="text-xs text-slate-400">
            Side-by-side evaluation of Inherent vs Residual risk under treatment:{" "}
            <span className="capitalize font-semibold text-indigo-400">{treatment}</span>
          </p>
        </div>

        {deltaScore > 0 && residualScore > 0 && (
          <div className="flex items-center space-x-2 bg-indigo-950/60 border border-indigo-700/50 px-3 py-1.5 rounded-lg text-xs text-indigo-300">
            <span>Reduction:</span>
            <span className="font-bold text-indigo-200">-{deltaScore} pts ({deltaPercent}%)</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Inherent Box */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Inherent Risk
            </span>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${inherentBadge.bg} ${inherentBadge.text} ${inherentBadge.border}`}
            >
              {inherentLevel}
            </span>
          </div>

          <div className="flex items-baseline space-x-3">
            <span className="text-3xl font-extrabold text-white">{roundedInherent}</span>
            <span className="text-xs text-slate-400">/ 25 max</span>
          </div>

          {/* Bar */}
          <div className="space-y-1">
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-rose-500 rounded-full transition-all duration-500"
                style={{ width: `${inherentPercent}%` }}
                role="progressbar"
                aria-valuenow={roundedInherent}
                aria-valuemin={0}
                aria-valuemax={25}
                aria-label="Inherent risk score bar"
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Likelihood: <strong className="text-slate-200">{inherentLikelihood}</strong> / 5</span>
              <span>Impact: <strong className="text-slate-200">{inherentImpact}</strong> / 5</span>
            </div>
          </div>
        </div>

        {/* Residual Box */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Residual Risk
            </span>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${residualBadge.bg} ${residualBadge.text} ${residualBadge.border}`}
            >
              {residualLevel}
            </span>
          </div>

          <div className="flex items-baseline space-x-3">
            <span className="text-3xl font-extrabold text-white">{roundedResidual}</span>
            <span className="text-xs text-slate-400">/ 25 max</span>
          </div>

          {/* Bar */}
          <div className="space-y-1">
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${residualPercent}%` }}
                role="progressbar"
                aria-valuenow={roundedResidual}
                aria-valuemin={0}
                aria-valuemax={25}
                aria-label="Residual risk score bar"
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Likelihood: <strong className="text-slate-200">{roundTo(residualLikelihood, 1)}</strong> / 5</span>
              <span>Impact: <strong className="text-slate-200">{roundTo(residualImpact, 1)}</strong> / 5</span>
            </div>
          </div>
        </div>
      </div>

      {/* Treatment Notes */}
      {treatment === "avoid" && (
        <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-lg p-3 text-xs text-emerald-300 flex items-center space-x-2">
          <span className="font-bold">Avoided:</span>
          <span>Risk removed completely (residual score = 0). Excluded from active matrix and snapshots.</span>
        </div>
      )}

      {treatment !== "mitigate" && treatment !== "avoid" && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 text-xs text-slate-300">
          <span className="font-semibold text-amber-400">Note: </span>
          Controls are preserved but ignored for score calculation under the <strong className="capitalize">{treatment}</strong> treatment.
        </div>
      )}
    </div>
  );
}
