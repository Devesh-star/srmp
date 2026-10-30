"use client";

import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  LabelList,
} from "recharts";
import { ChartCard } from "./ChartCard";
import { RiskLevel, roundTo } from "@/lib/riskEngine";
import { LEVEL_HEX, getLevelBadgeClasses } from "@/lib/ui/levelStyles";

interface RiskDistributionChartProps {
  distribution: Array<{ level: RiskLevel; count: number }>;
  basis: "residual" | "inherent";
}

export function RiskDistributionChart({ distribution, basis }: RiskDistributionChartProps) {
  const totalCount = distribution.reduce((sum, d) => sum + d.count, 0);

  const tableData = distribution.map((d) => ({
    level: d.level,
    count: d.count,
    percent: totalCount > 0 ? roundTo((d.count / totalCount) * 100, 1) : 0,
  }));

  const tableColumns = [
    {
      header: "Severity Level",
      render: (row: (typeof tableData)[0]) => (
        <span className={`px-2 py-0.5 rounded text-xs border font-medium ${getLevelBadgeClasses(row.level)}`}>
          {row.level}
        </span>
      ),
    },
    {
      header: "Risk Count",
      render: (row: (typeof tableData)[0]) => <span className="font-mono">{row.count}</span>,
    },
    {
      header: "Share (%)",
      render: (row: (typeof tableData)[0]) => <span className="font-mono">{row.percent}%</span>,
    },
  ];

  return (
    <ChartCard
      title={`Risk Distribution (${basis})`}
      subtitle={`Count of active risks across severity tiers evaluated on ${basis} risk score`}
      ariaLabel={`Risk Distribution across severity tiers for ${basis} basis`}
      tableData={tableData}
      tableColumns={tableColumns}
      tableCaption="Active risk distribution by severity tier"
      heightClass="h-64"
    >
      {(reducedMotion) => (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={distribution}
            margin={{ top: 20, right: 20, left: -10, bottom: 5 }}
          >
            <XAxis
              dataKey="level"
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
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const data = payload[0].payload as { level: RiskLevel; count: number };
                const pct = totalCount > 0 ? roundTo((data.count / totalCount) * 100, 1) : 0;
                return (
                  <div className="bg-slate-900 border border-slate-700 p-2.5 rounded shadow-xl text-xs space-y-1">
                    <p className="font-bold text-white flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block"
                        style={{ backgroundColor: LEVEL_HEX[data.level] }}
                      />
                      {data.level} Severity
                    </p>
                    <p className="text-slate-300 font-mono">
                      {data.count} risks ({pct}%)
                    </p>
                  </div>
                );
              }}
            />
            <Bar
              dataKey="count"
              radius={[4, 4, 0, 0]}
              isAnimationActive={!reducedMotion}
            >
              {distribution.map((entry) => (
                <Cell key={entry.level} fill={LEVEL_HEX[entry.level]} />
              ))}
              <LabelList
                dataKey="count"
                position="top"
                fill="#cbd5e1"
                fontSize={11}
                fontWeight="bold"
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
