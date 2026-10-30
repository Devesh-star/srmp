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
import { RiskLevel } from "@/lib/riskEngine";
import { LEVEL_HEX } from "@/lib/ui/levelStyles";

interface CategoryData {
  category: string;
  Low: number;
  Medium: number;
  High: number;
  Critical: number;
  total: number;
}

interface RiskByCategoryChartProps {
  byCategory: CategoryData[];
  basis: "residual" | "inherent";
}

export function RiskByCategoryChart({ byCategory, basis }: RiskByCategoryChartProps) {
  const tableColumns = [
    {
      header: "Threat Category",
      render: (row: CategoryData) => <span className="font-semibold text-white">{row.category}</span>,
    },
    {
      header: "Low",
      render: (row: CategoryData) => <span className="font-mono text-emerald-400">{row.Low}</span>,
    },
    {
      header: "Medium",
      render: (row: CategoryData) => <span className="font-mono text-amber-400">{row.Medium}</span>,
    },
    {
      header: "High",
      render: (row: CategoryData) => <span className="font-mono text-orange-400">{row.High}</span>,
    },
    {
      header: "Critical",
      render: (row: CategoryData) => <span className="font-mono text-rose-400">{row.Critical}</span>,
    },
    {
      header: "Total",
      render: (row: CategoryData) => <span className="font-mono font-bold text-white">{row.total}</span>,
    },
  ];

  return (
    <ChartCard
      title={`Risk by Threat Category (${basis})`}
      subtitle={`Severity breakdown per operational category evaluated on ${basis} risk score`}
      ariaLabel={`Risk breakdown across threat categories for ${basis} basis`}
      tableData={byCategory}
      tableColumns={tableColumns}
      tableCaption="Risk breakdown by threat category and severity level"
      heightClass="h-64"
    >
      {(reducedMotion) => (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={byCategory}
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
                const total = payload.reduce((sum, p) => sum + (Number(p.value) || 0), 0);
                return (
                  <div className="bg-slate-900 border border-slate-700 p-2.5 rounded shadow-xl text-xs space-y-1.5">
                    <p className="font-bold text-white border-b border-slate-800 pb-1">
                      {label} ({total} risks)
                    </p>
                    {payload.map((entry) => {
                      const lvl = entry.dataKey as RiskLevel;
                      return (
                        <div key={lvl} className="flex items-center justify-between gap-4">
                          <span className="flex items-center gap-1.5 text-slate-300">
                            <span
                              className="w-2 h-2 rounded-full inline-block"
                              style={{ backgroundColor: LEVEL_HEX[lvl] }}
                            />
                            {lvl}:
                          </span>
                          <span className="font-mono font-bold text-white">{entry.value}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
              formatter={(val: string) => <span className="text-slate-300">{val}</span>}
            />
            <Bar
              dataKey="Low"
              stackId="a"
              fill={LEVEL_HEX.Low}
              isAnimationActive={!reducedMotion}
            />
            <Bar
              dataKey="Medium"
              stackId="a"
              fill={LEVEL_HEX.Medium}
              isAnimationActive={!reducedMotion}
            />
            <Bar
              dataKey="High"
              stackId="a"
              fill={LEVEL_HEX.High}
              isAnimationActive={!reducedMotion}
            />
            <Bar
              dataKey="Critical"
              stackId="a"
              fill={LEVEL_HEX.Critical}
              radius={[4, 4, 0, 0]}
              isAnimationActive={!reducedMotion}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
