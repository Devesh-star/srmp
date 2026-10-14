"use client";

import React from "react";

export interface HistoryItem {
  action: string;
  actionLabel?: string;
  actorName: string;
  timestamp: string;
  changedFields: string[];
  note?: string;
}

interface RiskHistoryPanelProps {
  history: HistoryItem[];
}

export function RiskHistoryPanel({ history }: RiskHistoryPanelProps) {
  if (history.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl text-center text-xs text-slate-400">
        No history records found for this risk.
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
      <div className="border-b border-slate-800 pb-3">
        <h2 className="text-lg font-semibold text-white">Audit History & Timeline</h2>
        <p className="text-xs text-slate-400">
          Complete, immutable lifecycle history of changes and governance actions.
        </p>
      </div>

      <div className="space-y-3">
        {history.map((item, idx) => (
          <div
            key={idx}
            className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-lg text-xs space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200">
                {item.actionLabel || item.action}
              </span>
              <span className="text-[11px] text-slate-400">
                {new Date(item.timestamp).toLocaleString()}
              </span>
            </div>

            <div className="flex items-center space-x-2 text-slate-400 text-[11px]">
              <span>Actor:</span>
              <span className="font-mono text-slate-300">{item.actorName}</span>
            </div>

            {item.changedFields && item.changedFields.length > 0 && (
              <div className="text-[11px] text-slate-400">
                <span>Changed: </span>
                <span className="text-indigo-300 font-mono">
                  {item.changedFields.join(", ")}
                </span>
              </div>
            )}

            {item.note && (
              <div className="mt-1 p-2 bg-slate-900 border border-slate-800 rounded text-[11px] text-slate-300">
                <strong className="text-slate-400">Note / Reason: </strong>
                {item.note}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
