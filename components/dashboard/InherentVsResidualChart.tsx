"use client";

import React from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { ChartCard } from "./ChartCard";
import { roundTo } from "@/lib/riskEngine";

export interface InherentVsResidualItem {
  riskId: string;
  label: string;
  inherent: number;
  residual: number;
}

interface InherentVsResidualChartProps {
  inherentVsResidual: InherentVsResidualItem[];
}

export function InherentVsResidualChart({ inherentVsResidual }: InherentVsResidualChartProps) {
  const tableData = inherentVsResidual.map((item) => {
    const diff = item.inherent - item.residual;
    const pct = item.inherent > 0 ? roundTo((diff / item.inherent) * 100, 1) : 0;
    return {
      ...item,
      diff: roundTo(diff, 1),
      pct,
    };
  });

  const tableColumns = [
    {
      header: "Risk",
      render: (row: (typeof tableData)[0]) => (
        <Link
          href={`/risks/${row.riskId}`}
          className="font-mono font-bold text-indigo-400 hover:text-indigo-300 hover:underline"
        >
          {row.riskId}
        </Link>
      ),
    },
    {
      header: "Description",
      render: (row: (typeof tableData)[0]) => <span className="text-slate-300">{row.label}</span>,
    },
    {
      header: "Inherent Score",
      render: (row: (typeof tableData)[0]) => (
        <span className="font-mono font-bold text-amber-400">{roundTo(row.inherent, 1)}</span>
      ),
    },
    {
      header: "Residual Score",
      render: (row: (typeof tableData)[0]) => (
        <span className="font-mono font-bold text-emerald-400">{roundTo(row.residual, 1)}</span>
      ),
    },
    {
      header: "Mitigation Reduction",
      render: (row: (typeof tableData)[0]) => (
        <span className="font-mono text-indigo-300">
          -{row.diff} pts ({row.pct}%)
        </span>
      ),
    },
  ];

  return (
    <ChartCard
      title="Inherent vs Residual Comparison"
      subtitle="Top 10 risks by inherent score showing risk compression achieved by controls"
      ariaLabel="Inherent versus Residual risk comparison for top 10 risks"
      tableData={tableData}
      tableColumns={tableColumns}
      tableCaption="Top 10 risks comparing inherent versus residual severity"
      heightClass="h-72"
    >
      {(reducedMotion) => (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={inherentVsResidual}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
          >
            <XAxis
              type="number"
              domain={[0, 25]}
              stroke="#94a3b8"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: "#334155" }}
            />
            <YAxis
              type="category"
              dataKey="riskId"
              stroke="#94a3b8"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: "#334155" }}
              width={55}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const d = payload[0].payload as InherentVsResidualItem;
                const diff = roundTo(d.inherent - d.residual, 1);
                const pct = d.inherent > 0 ? roundTo((diff / d.inherent) * 100, 1) : 0;
                return (
                  <div className="bg-slate-900 border border-slate-700 p-2.5 rounded shadow-xl text-xs space-y-1">
                    <p className="font-bold text-white border-b border-slate-800 pb-1">
                      {d.riskId} • {d.label}
                    </p>
                    <div className="flex justify-between gap-4 text-amber-400 font-mono">
                      <span>Inherent:</span>
                      <span className="font-bold">{roundTo(d.inherent, 1)}</span>
                    </div>
                    <div className="flex justify-between gap-4 text-emerald-400 font-mono">
                      <span>Residual:</span>
                      <span className="font-bold">{roundTo(d.residual, 1)}</span>
                    </div>
                    <div className="flex justify-between gap-4 text-indigo-300 font-mono pt-1 border-t border-slate-800">
                      <span>Reduction:</span>
                      <span className="font-bold">-{diff} pts ({pct}%)</span>
                    </div>
                  </div>
                );
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: "11px", paddingTop: "4px" }}
              formatter={(val: string) => <span className="text-slate-300">{val}</span>}
            />
            <Bar
              dataKey="inherent"
              name="Inherent Risk"
              fill="#f59e0b"
              radius={[0, 3, 3, 0]}
              isAnimationActive={!reducedMotion}
            />
            <Bar
              dataKey="residual"
              name="Residual Risk"
              fill="#10b981"
              radius={[0, 3, 3, 0]}
              isAnimationActive={!reducedMotion}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
