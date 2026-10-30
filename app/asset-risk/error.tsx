"use client";

import React from "react";

export default function AssetRiskError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
      <div className="w-14 h-14 rounded-full bg-rose-950/80 border border-rose-800 text-rose-400 flex items-center justify-center text-2xl mx-auto">
        ⚠️
      </div>
      <h2 className="text-xl font-bold text-white">Failed to load asset risk data</h2>
      <p className="text-sm text-slate-400">
        {error.message || "An unexpected error occurred while loading asset risk postures."}
      </p>
      <div className="pt-2">
        <button
          type="button"
          onClick={() => reset()}
          className="px-4 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
