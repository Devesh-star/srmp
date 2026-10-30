import React from "react";

export default function DashboardLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="space-y-2">
          <div className="h-7 w-64 bg-slate-800 rounded"></div>
          <div className="h-4 w-96 bg-slate-800/60 rounded"></div>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-9 w-48 bg-slate-800 rounded-lg"></div>
          <div className="h-9 w-32 bg-slate-800 rounded-lg"></div>
        </div>
      </div>

      {/* Hero Skeleton */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="h-48 bg-slate-900 border border-slate-800 rounded-xl p-6"></div>
          <div className="h-48 bg-slate-900 border border-slate-800 rounded-xl p-6"></div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-20 bg-slate-900 border border-slate-800 rounded-lg"></div>
          ))}
        </div>
      </div>

      {/* Charts Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="h-96 bg-slate-900 border border-slate-800 rounded-xl p-5"
          ></div>
        ))}
      </div>
    </div>
  );
}
