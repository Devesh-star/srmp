"use client";

import React from "react";
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

interface ControlCategoryItem {
  category: string;
  planned: number;
  implemented: number;
}

export interface ControlImplementationData {
  planned: number;
  implemented: number;
  total: number;
  percentImplemented: number;
  byCategory: ControlCategoryItem[];
}

interface ControlImplementationChartProps {
  controlImplementation: ControlImplementationData;
}

export function ControlImplementationChart({
  controlImplementation,
}: ControlImplementationChartProps) {
  const tableData = controlImplementation.byCategory.map((c) => {
    const catTotal = c.planned + c.implemented;
    const catPct = catTotal > 0 ? roundTo((c.implemented / catTotal) * 100, 0) : 0;
    return {
      category: c.category,
      implemented: c.implemented,
      planned: c.planned,
      total: catTotal,
      percent: catPct,
    };
  });

  const tableColumns = [
    {
      header: "Control Category",
      render: (row: (typeof tableData)[0]) => <span className="font-semibold text-white">{row.category}</span>,
    },
    {
      header: "Implemented",
      render: (row: (typeof tableData)[0]) => <span className="font-mono text-emerald-400">{row.implemented}</span>,
    },
    {
      header: "Planned",
      render: (row: (typeof tableData)[0]) => <span className="font-mono text-indigo-400">{row.planned}</span>,
    },
    {
      header: "Total",
      render: (row: (typeof tableData)[0]) => <span className="font-mono text-slate-300">{row.total}</span>,
    },
    {
      header: "Progress (%)",
      render: (row: (typeof tableData)[0]) => <span className="font-mono font-bold text-white">{row.percent}%</span>,
    },
  ];

  return (
    <ChartCard
      title="Control Implementation Progress"
      subtitle={`${controlImplementation.percentImplemented}% of attached controls are implemented (${controlImplementation.implemented} of ${controlImplementation.total})`}
      ariaLabel="Control Implementation Progress across security categories"
      tableData={tableData}
      tableColumns={tableColumns}
      tableCaption="Security control implementation progress by category"
      heightClass="h-64"
    >
      {(reducedMotion) => (
        <div className="flex flex-col h-full justify-between">
          {/* Progress bar pill */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3 mb-2 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-400">Attached Controls: </span>
              <span className="font-bold text-white">{controlImplementation.total}</span>
              <span className="text-slate-500 mx-2">•</span>
              <span className="text-emerald-400 font-semibold">{controlImplementation.implemented} implemented</span>
              <span className="text-slate-500 mx-2">•</span>
              <span className="text-indigo-400 font-semibold">{controlImplementation.planned} planned</span>
            </div>
            <span className="font-mono font-extrabold text-sm text-emerald-400">
              {controlImplementation.percentImplemented}%
            </span>
          </div>

          <div className="flex-1 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={controlImplementation.byCategory}
                margin={{ top: 10, right: 20, left: -10, bottom: 5 }}
              >
                <XAxis
                  dataKey="category"
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                  axisLine={{ stroke: "#334155" }}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                  axisLine={{ stroke: "#334155" }}
                  allowDecimals={false}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    const d = payload[0].payload as ControlCategoryItem;
                    const catTotal = d.implemented + d.planned;
                    const pct = catTotal > 0 ? roundTo((d.implemented / catTotal) * 100, 0) : 0;
                    return (
                      <div className="bg-slate-900 border border-slate-700 p-2.5 rounded shadow-xl text-xs space-y-1.5">
                        <p className="font-bold text-white border-b border-slate-800 pb-1">
                          {label} Controls ({catTotal} attached)
                        </p>
                        <div className="flex items-center justify-between gap-4 text-emerald-400 font-mono">
                          <span>Implemented:</span>
                          <span className="font-bold">{d.implemented}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-indigo-400 font-mono">
                          <span>Planned:</span>
                          <span className="font-bold">{d.planned}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-slate-300 font-mono pt-1 border-t border-slate-800">
                          <span>Progress:</span>
                          <span className="font-bold text-white">{pct}%</span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: "11px", paddingTop: "4px" }}
                  formatter={(val: string) => <span className="text-slate-300 capitalize">{val}</span>}
                />
                <Bar
                  dataKey="implemented"
                  name="Implemented"
                  stackId="a"
                  fill="#10b981"
                  isAnimationActive={!reducedMotion}
                />
                <Bar
                  dataKey="planned"
                  name="Planned"
                  stackId="a"
                  fill="#6366f1"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={!reducedMotion}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </ChartCard>
  );
}
