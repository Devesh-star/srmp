"use client";

import React, { useSyncExternalStore } from "react";
import { useReducedMotion } from "@/lib/ui/useReducedMotion";

interface TableColumn<T> {
  header: string;
  render: (row: T) => React.ReactNode;
}

interface ChartCardProps<T> {
  title: string;
  subtitle?: string;
  ariaLabel: string;
  heightClass?: string;
  tableData?: T[];
  tableColumns?: TableColumn<T>[];
  tableCaption?: string;
  children: (reducedMotion: boolean) => React.ReactNode;
}

const emptySubscribe = () => () => {};

export function ChartCard<T>({
  title,
  subtitle,
  ariaLabel,
  heightClass = "h-72",
  tableData,
  tableColumns,
  tableCaption,
  children,
}: ChartCardProps<T>) {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const reducedMotion = useReducedMotion();

  return (
    <section
      className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col justify-between"
      aria-label={ariaLabel}
    >
      <div>
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 mb-4 border-b border-slate-800/80 pb-3">
          <div>
            <h3 className="text-sm font-semibold text-white tracking-tight">{title}</h3>
            {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
        </div>

        <div className={`w-full ${heightClass} relative`}>
          {!mounted ? (
            <div
              className={`w-full ${heightClass} bg-slate-950/60 rounded-lg animate-pulse flex items-center justify-center text-xs text-slate-500`}
            >
              Loading chart...
            </div>
          ) : (
            children(reducedMotion)
          )}
        </div>
      </div>

      {tableData && tableColumns && tableColumns.length > 0 && (
        <details className="mt-4 pt-3 border-t border-slate-800/80 text-xs text-slate-400 group">
          <summary className="cursor-pointer font-medium hover:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded px-1 py-0.5 inline-block">
            ▶ View data as table
          </summary>
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-left border-collapse text-xs">
              {tableCaption && <caption className="sr-only">{tableCaption}</caption>}
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                  {tableColumns.map((col, idx) => (
                    <th key={idx} scope="col" className="py-1.5 px-2">
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {tableData.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-slate-800/30">
                    {tableColumns.map((col, cIdx) => (
                      <td key={cIdx} className="py-1.5 px-2 text-slate-300">
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}
