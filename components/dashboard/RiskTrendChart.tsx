"use client";

import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import { ChartCard } from "./ChartCard";
import { mergeTrendWithLive, TrendChartItem } from "@/lib/charts/helpers";
import { AssessmentTrendItemDTO } from "@/services/assessmentService";
import { RiskLevel, roundTo } from "@/lib/riskEngine";
import { LEVEL_HEX } from "@/lib/ui/levelStyles";

interface OverallBand {
  level: RiskLevel;
  from: number;
  to: number | null;
}

interface RiskTrendChartProps {
  trend: AssessmentTrendItemDTO[];
  live: {
    overallScore: number;
    inherentOverall: number;
    maxScore: number;
    counts: Record<RiskLevel, number>;
    date: string;
  };
  bandsOverall: OverallBand[];
  onTakeSnapshotClick?: () => void;
  canTakeSnapshot?: boolean;
}

export function RiskTrendChart({
  trend,
  live,
  bandsOverall,
  onTakeSnapshotClick,
  canTakeSnapshot,
}: RiskTrendChartProps) {
  const points = mergeTrendWithLive(trend, live);

  const tableData = points.map((p) => ({
    label: p.label,
    date: p.date ? new Date(p.date).toLocaleDateString() : "—",
    residual: roundTo(p.overallScore, 1),
    inherent: roundTo(p.inherentOverall, 1),
    max: roundTo(p.maxScore, 1),
    isLive: p.isLive,
  }));

  const tableColumns = [
    {
      header: "Milestone",
      render: (row: (typeof tableData)[0]) => (
        <span className="font-semibold text-white">
          {row.label} {row.isLive && <span className="text-[10px] text-indigo-400 bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-700/50">Live</span>}
        </span>
      ),
    },
    {
      header: "Date",
      render: (row: (typeof tableData)[0]) => <span className="text-slate-400">{row.date}</span>,
    },
    {
      header: "Residual Overall (0–100)",
      render: (row: (typeof tableData)[0]) => <span className="font-mono text-emerald-400 font-bold">{row.residual}</span>,
    },
    {
      header: "Inherent Overall (0–100)",
      render: (row: (typeof tableData)[0]) => <span className="font-mono text-amber-400">{row.inherent}</span>,
    },
    {
      header: "Max Risk Score (0–25)",
      render: (row: (typeof tableData)[0]) => <span className="font-mono text-rose-400">{row.max}</span>,
    },
  ];

  if (points.length < 2) {
    return (
      <section
        className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col justify-between"
        aria-label="Risk Posture Trend Over Time"
      >
        <div className="border-b border-slate-800/80 pb-3 mb-4">
          <h3 className="text-sm font-semibold text-white tracking-tight">Risk Posture Trend Over Time</h3>
          <p className="text-xs text-slate-400 mt-0.5">Historical overall score trajectory across assessment milestones</p>
        </div>
        <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-slate-950/40 rounded-lg border border-dashed border-slate-800">
          <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
            📈
          </div>
          <h4 className="text-sm font-semibold text-white mb-1">Insufficient Trend Points</h4>
          <p className="text-xs text-slate-400 max-w-sm mb-4">
            A trend chart requires at least 2 snapshot milestones to track how your organizational risk posture evolves over time.
          </p>
          {canTakeSnapshot && onTakeSnapshotClick && (
            <button
              type="button"
              onClick={onTakeSnapshotClick}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition-colors"
            >
              Take First Snapshot
            </button>
          )}
        </div>
      </section>
    );
  }

  return (
    <ChartCard
      title="Risk Posture Trend Over Time"
      subtitle="Historical trajectory of residual and inherent overall scores with live posture"
      ariaLabel="Historical risk posture trend chart"
      tableData={tableData}
      tableColumns={tableColumns}
      tableCaption="Historical assessment snapshots and current live posture"
      heightClass="h-72"
    >
      {(reducedMotion) => (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={points}
            margin={{ top: 20, right: 30, left: -10, bottom: 5 }}
          >
            <XAxis
              dataKey="label"
              stroke="#94a3b8"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: "#334155" }}
            />
            <YAxis
              domain={[0, 100]}
              stroke="#94a3b8"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: "#334155" }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const d = payload[0].payload as TrendChartItem;
                const dateStr = d.date ? new Date(d.date).toLocaleDateString() : "Live";
                return (
                  <div className="bg-slate-900 border border-slate-700 p-2.5 rounded shadow-xl text-xs space-y-1.5">
                    <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-1">
                      <span className="font-bold text-white">{d.label}</span>
                      <span className="text-[11px] text-slate-400">{dateStr}</span>
                    </div>
                    <div className="flex justify-between gap-4 text-emerald-400 font-mono">
                      <span>Residual Overall:</span>
                      <span className="font-bold">{roundTo(d.overallScore, 1)} / 100</span>
                    </div>
                    <div className="flex justify-between gap-4 text-amber-400 font-mono">
                      <span>Inherent Overall:</span>
                      <span className="font-bold">{roundTo(d.inherentOverall, 1)} / 100</span>
                    </div>
                    <div className="flex justify-between gap-4 text-rose-400 font-mono">
                      <span>Worst Single Risk:</span>
                      <span className="font-bold">{roundTo(d.maxScore, 1)} / 25</span>
                    </div>
                    {d.isLive && (
                      <p className="text-[10px] text-indigo-300 font-medium italic pt-1 border-t border-slate-800">
                        * Live active posture
                      </p>
                    )}
                  </div>
                );
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: "11px", paddingTop: "6px" }}
              formatter={(val: string) => <span className="text-slate-300">{val}</span>}
            />

            {/* Overall Severity Threshold Reference Lines */}
            {bandsOverall.map((band) => {
              if (band.from === 0) return null;
              return (
                <ReferenceLine
                  key={band.level}
                  y={band.from}
                  stroke={LEVEL_HEX[band.level]}
                  strokeDasharray="3 3"
                  strokeOpacity={0.6}
                  label={{
                    value: `${band.level} (≥${band.from})`,
                    fill: LEVEL_HEX[band.level],
                    position: "insideTopRight",
                    fontSize: 10,
                  }}
                />
              );
            })}

            <Line
              type="monotone"
              dataKey="overallScore"
              name="Residual Overall Score"
              stroke="#10b981"
              strokeWidth={2.5}
              dot={{ r: 4, fill: "#10b981" }}
              activeDot={{ r: 6 }}
              isAnimationActive={!reducedMotion}
            />
            <Line
              type="monotone"
              dataKey="inherentOverall"
              name="Inherent Overall Score"
              stroke="#f59e0b"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={{ r: 3, fill: "#f59e0b" }}
              activeDot={{ r: 5 }}
              isAnimationActive={!reducedMotion}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
