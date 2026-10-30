"use client";

import React from "react";
import Link from "next/link";
import { ChartCard } from "./ChartCard";
import { RiskLevel, roundTo, MAX_SCORE } from "@/lib/riskEngine";
import { LEVEL_HEX, getLevelBadgeClasses, getStatusBadgeClasses } from "@/lib/ui/levelStyles";

export interface TopRiskItem {
  riskId: string;
  assetName: string;
  threatName: string;
  vulnerabilityName: string;
  score: number;
  level: RiskLevel;
  inherentScore: number;
  residualScore: number;
  status: string;
}

interface TopRisksChartProps {
  topRisks: TopRiskItem[];
  basis: "residual" | "inherent";
}

export function TopRisksChart({ topRisks, basis }: TopRisksChartProps) {
  const tableColumns = [
    {
      header: "Risk ID",
      render: (row: TopRiskItem) => (
        <Link
          href={`/risks/${row.riskId}`}
          className="font-mono font-bold text-indigo-400 hover:text-indigo-300 hover:underline"
        >
          {row.riskId}
        </Link>
      ),
    },
    {
      header: "Asset",
      render: (row: TopRiskItem) => <span className="text-slate-300">{row.assetName}</span>,
    },
    {
      header: "Threat",
      render: (row: TopRiskItem) => <span className="text-slate-300">{row.threatName}</span>,
    },
    {
      header: `${basis === "residual" ? "Residual" : "Inherent"} Score`,
      render: (row: TopRiskItem) => (
        <span className="font-mono font-bold text-white">{roundTo(row.score, 1)}</span>
      ),
    },
    {
      header: "Level",
      render: (row: TopRiskItem) => (
        <span className={`px-2 py-0.5 rounded text-[11px] border font-medium ${getLevelBadgeClasses(row.level)}`}>
          {row.level}
        </span>
      ),
    },
    {
      header: "Status",
      render: (row: TopRiskItem) => (
        <span className={`px-2 py-0.5 rounded text-[11px] border font-medium ${getStatusBadgeClasses(row.status)}`}>
          {row.status}
        </span>
      ),
    },
  ];

  return (
    <ChartCard
      title={`Top 10 Risks (${basis})`}
      subtitle={`Highest severity active risks ranked by ${basis} score`}
      ariaLabel={`Top 10 risks ranked by ${basis} score`}
      tableData={topRisks}
      tableColumns={tableColumns}
      tableCaption="Top 10 highest exposure risks"
      heightClass="h-auto min-h-[18rem]"
    >
      {(reducedMotion) => (
        <div className="space-y-2 py-1">
          {topRisks.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-xs text-slate-500">
              No active risks found
            </div>
          ) : (
            topRisks.map((risk) => {
              const pct = Math.min(100, Math.max(0, (risk.score / MAX_SCORE) * 100));
              const hex = LEVEL_HEX[risk.level] || "#94a3b8";
              return (
                <Link
                  key={risk.riskId}
                  href={`/risks/${risk.riskId}`}
                  className="group block p-2 rounded-lg bg-slate-950/40 hover:bg-slate-800/60 border border-slate-800/80 transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <div className="flex items-center justify-between text-xs mb-1.5 gap-2">
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-mono font-bold text-indigo-400 group-hover:text-indigo-300">
                        {risk.riskId}
                      </span>
                      <span className="text-slate-400 truncate">
                        {risk.assetName} • <span className="text-slate-300">{risk.threatName}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-1.5 py-0.2 rounded text-[10px] border font-semibold ${getLevelBadgeClasses(risk.level)}`}>
                        {risk.level}
                      </span>
                      <span className="font-mono font-extrabold text-white text-xs">
                        {roundTo(risk.score, 1)}
                      </span>
                    </div>
                  </div>

                  {/* Horizontal Bar */}
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${reducedMotion ? "" : "transition-all duration-500 ease-out"}`}
                      style={{
                        width: `${pct}%`,
                        backgroundColor: hex,
                      }}
                    />
                  </div>
                </Link>
              );
            })
          )}
        </div>
      )}
    </ChartCard>
  );
}
