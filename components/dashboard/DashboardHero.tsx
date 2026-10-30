"use client";

import React from "react";
import Link from "next/link";
import { RiskLevel, roundTo } from "@/lib/riskEngine";
import { describeChange } from "@/lib/charts/helpers";
import { getLevelBadgeClasses } from "@/lib/ui/levelStyles";

export interface DashboardHeroProps {
  basis: "residual" | "inherent";
  totals: {
    assets: number;
    includedRisks: number;
    closedRisks: number;
  };
  overall: {
    score: number;
    level: RiskLevel;
    max: number;
    maxLevel: RiskLevel;
    counts: Record<RiskLevel, number>;
  };
  projected: {
    score: number;
    level: RiskLevel;
    delta: number;
    risksAffected: number;
  };
  snapshotComparison: {
    label: string;
    date: string;
    score: number;
    delta: number;
  } | null;
  canTakeSnapshot?: boolean;
  onTakeSnapshotClick?: () => void;
}

export function DashboardHero({
  basis,
  totals,
  overall,
  projected,
  snapshotComparison,
  canTakeSnapshot,
  onTakeSnapshotClick,
}: DashboardHeroProps) {
  const comparisonChange = snapshotComparison ? describeChange(snapshotComparison.delta) : null;
  const projectedChange = describeChange(projected.delta);

  return (
    <div className="space-y-4">
      {/* Top 2 Hero Cards: Overall & Projected */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Overall Risk Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Overall Risk Posture ({basis})
              </span>
              <span className={`px-2.5 py-0.5 rounded-full border text-xs font-bold ${getLevelBadgeClasses(overall.level)}`}>
                {overall.level} Severity
              </span>
            </div>

            <div className="flex items-baseline justify-between mt-2">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl sm:text-5xl font-black text-white tracking-tight font-mono">
                  {roundTo(overall.score, 1)}
                </span>
                <span className="text-slate-400 font-bold text-sm">/ 100</span>
              </div>

              {/* Beside it: Max single risk score and max level */}
              <div className="text-right bg-slate-950/60 border border-slate-800 rounded-lg p-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                  Worst Single Risk
                </span>
                <div className="flex items-center justify-end gap-1.5">
                  <span className={`px-2 py-0.2 rounded text-[11px] border font-bold ${getLevelBadgeClasses(overall.maxLevel)}`}>
                    {overall.maxLevel}
                  </span>
                  <span className="text-base font-extrabold text-white font-mono">
                    {roundTo(overall.max, 1)}
                  </span>
                  <span className="text-[10px] text-slate-500">/ 25</span>
                </div>
              </div>
            </div>
          </div>

          {/* Snapshot Comparison Footer */}
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
            {snapshotComparison ? (
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Milestone comparison:</span>
                <span
                  className={`font-semibold ${
                    comparisonChange?.direction === "down"
                      ? "text-emerald-400"
                      : comparisonChange?.direction === "up"
                      ? "text-rose-400"
                      : "text-slate-300"
                  }`}
                >
                  {comparisonChange?.text}
                </span>
                <span className="text-slate-500">
                  since {snapshotComparison.label} ({new Date(snapshotComparison.date).toLocaleDateString()})
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between w-full">
                <span className="text-slate-500 italic">No snapshots yet to compare</span>
                {canTakeSnapshot && onTakeSnapshotClick && (
                  <button
                    type="button"
                    onClick={onTakeSnapshotClick}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                  >
                    + Take baseline snapshot
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Projected Risk Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Projected Overall Risk
              </span>
              <span className={`px-2.5 py-0.5 rounded-full border text-xs font-bold ${getLevelBadgeClasses(projected.level)}`}>
                {projected.level} Projected
              </span>
            </div>

            <div className="mt-2 space-y-1">
              <p className="text-xs text-slate-300 font-medium">
                If all planned controls are implemented:
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl sm:text-5xl font-black text-indigo-400 tracking-tight font-mono">
                  {roundTo(projected.score, 1)}
                </span>
                <span className="text-slate-400 font-bold text-sm">/ 100</span>

                <span
                  className={`ml-3 text-xs font-bold px-2 py-0.5 rounded border ${
                    projected.delta < 0
                      ? "bg-emerald-950/60 border-emerald-700 text-emerald-400"
                      : projected.delta > 0
                      ? "bg-rose-950/60 border-rose-700 text-rose-400"
                      : "bg-slate-800 border-slate-700 text-slate-300"
                  }`}
                >
                  {projectedChange.text}
                </span>

                <span className="text-xs text-slate-400">
                  ({projected.risksAffected} {projected.risksAffected === 1 ? "risk" : "risks"} affected)
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 italic">
            * Estimate based on library effectiveness values
          </div>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Assets */}
        <Link
          href="/asset-risk"
          className="bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-lg p-3 transition-colors text-center focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Total Assets
          </span>
          <span className="text-2xl font-black text-white font-mono">{totals.assets}</span>
        </Link>

        {/* Included Risks */}
        <Link
          href={`/risks?basis=${basis}`}
          className="bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-lg p-3 transition-colors text-center focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Included Risks
          </span>
          <span className="text-2xl font-black text-indigo-400 font-mono">
            {totals.includedRisks}
          </span>
        </Link>

        {/* Critical */}
        <Link
          href={`/risks?level=Critical&basis=${basis}`}
          className="bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-lg p-3 transition-colors text-center border-l-2 border-l-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 block mb-1">
            Critical
          </span>
          <span className="text-2xl font-black text-rose-400 font-mono">
            {overall.counts.Critical}
          </span>
        </Link>

        {/* High */}
        <Link
          href={`/risks?level=High&basis=${basis}`}
          className="bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-lg p-3 transition-colors text-center border-l-2 border-l-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400 block mb-1">
            High
          </span>
          <span className="text-2xl font-black text-orange-400 font-mono">
            {overall.counts.High}
          </span>
        </Link>

        {/* Medium */}
        <Link
          href={`/risks?level=Medium&basis=${basis}`}
          className="bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-lg p-3 transition-colors text-center border-l-2 border-l-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block mb-1">
            Medium
          </span>
          <span className="text-2xl font-black text-amber-400 font-mono">
            {overall.counts.Medium}
          </span>
        </Link>

        {/* Low */}
        <Link
          href={`/risks?level=Low&basis=${basis}`}
          className="bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-lg p-3 transition-colors text-center border-l-2 border-l-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block mb-1">
            Low
          </span>
          <span className="text-2xl font-black text-emerald-400 font-mono">
            {overall.counts.Low}
          </span>
        </Link>
      </div>

      {/* Closed Risks Footnote */}
      {totals.closedRisks > 0 && (
        <div className="text-right text-xs text-slate-500">
          <Link
            href={`/risks?status=Closed&basis=${basis}`}
            className="hover:text-slate-400 underline"
          >
            {totals.closedRisks} closed {totals.closedRisks === 1 ? "risk" : "risks"} not counted
          </Link>
        </div>
      )}
    </div>
  );
}
