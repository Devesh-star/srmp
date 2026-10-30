"use client";

import React from "react";
import Link from "next/link";
import { ChartCard } from "./ChartCard";
import { RiskLevel, roundTo, MAX_SCORE } from "@/lib/riskEngine";
import { LEVEL_HEX, getLevelBadgeClasses } from "@/lib/ui/levelStyles";

export interface VulnerableAssetItem {
  assetId: string;
  name: string;
  type: string;
  owner?: string;
  criticality: number;
  riskCount: number;
  maxScore: number;
  level: RiskLevel | null;
  totalScore: number;
}

interface VulnerableAssetsChartProps {
  vulnerableAssets: VulnerableAssetItem[];
  basis: "residual" | "inherent";
}

export function VulnerableAssetsChart({ vulnerableAssets, basis }: VulnerableAssetsChartProps) {
  const tableColumns = [
    {
      header: "Asset Name",
      render: (row: VulnerableAssetItem) => (
        <Link
          href={`/asset-risk/${row.assetId}`}
          className="font-semibold text-indigo-400 hover:text-indigo-300 hover:underline"
        >
          {row.name}
        </Link>
      ),
    },
    {
      header: "Type",
      render: (row: VulnerableAssetItem) => <span className="text-slate-400 capitalize">{row.type}</span>,
    },
    {
      header: "Criticality",
      render: (row: VulnerableAssetItem) => <span className="font-mono">{roundTo(row.criticality, 1)}</span>,
    },
    {
      header: "Risks",
      render: (row: VulnerableAssetItem) => <span className="font-mono">{row.riskCount}</span>,
    },
    {
      header: "Worst Risk Score",
      render: (row: VulnerableAssetItem) => (
        <span className="font-mono font-bold text-white">
          {row.level ? roundTo(row.maxScore, 1) : "—"}
        </span>
      ),
    },
    {
      header: "Asset Level",
      render: (row: VulnerableAssetItem) => (
        <span
          className={`px-2 py-0.5 rounded text-[11px] border font-medium ${getLevelBadgeClasses(
            row.level
          )}`}
        >
          {row.level || "Not assessed"}
        </span>
      ),
    },
  ];

  return (
    <ChartCard
      title={`Most Vulnerable Assets (${basis})`}
      subtitle={`Assets carrying the highest single-point risk exposures ("worst risk" rule)`}
      ariaLabel={`Top vulnerable assets ranked by worst risk on ${basis} basis`}
      tableData={vulnerableAssets}
      tableColumns={tableColumns}
      tableCaption="Top vulnerable assets by worst risk exposure"
      heightClass="h-auto min-h-[18rem]"
    >
      {(reducedMotion) => (
        <div className="space-y-2 py-1">
          {vulnerableAssets.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-xs text-slate-500">
              No assessed assets found
            </div>
          ) : (
            vulnerableAssets.map((asset) => {
              const pct = asset.level
                ? Math.min(100, Math.max(0, (asset.maxScore / MAX_SCORE) * 100))
                : 0;
              const hex = asset.level ? LEVEL_HEX[asset.level] : "#64748b";

              return (
                <Link
                  key={asset.assetId}
                  href={`/asset-risk/${asset.assetId}`}
                  className="group block p-2 rounded-lg bg-slate-950/40 hover:bg-slate-800/60 border border-slate-800/80 transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <div className="flex items-center justify-between text-xs mb-1.5 gap-2">
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-bold text-slate-200 group-hover:text-indigo-300 truncate">
                        {asset.name}
                      </span>
                      <span className="text-[10px] text-slate-400 capitalize bg-slate-800/70 px-1.5 py-0.5 rounded">
                        {asset.type}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {asset.riskCount} {asset.riskCount === 1 ? "risk" : "risks"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] border font-semibold ${getLevelBadgeClasses(
                          asset.level
                        )}`}
                      >
                        {asset.level || "Not assessed"}
                      </span>
                      <span className="font-mono font-extrabold text-white text-xs">
                        {asset.level ? roundTo(asset.maxScore, 1) : "0"}
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

          <div className="pt-2 text-right">
            <Link
              href="/asset-risk"
              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1"
            >
              View all assets →
            </Link>
          </div>
        </div>
      )}
    </ChartCard>
  );
}
