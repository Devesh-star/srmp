import React from "react";

export default function SimulatorLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-pulse">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="space-y-2">
          <div className="h-7 w-64 bg-slate-800 rounded"></div>
          <div className="h-4 w-96 bg-slate-800/60 rounded"></div>
        </div>
        <div className="h-9 w-80 bg-slate-800 rounded-lg"></div>
      </div>

      <div className="h-44 bg-slate-900 border border-slate-800 rounded-xl"></div>
      <div className="h-64 bg-slate-900 border border-slate-800 rounded-xl"></div>
    </div>
  );
}
