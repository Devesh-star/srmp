"use client";

import React from "react";
import Link from "next/link";

export default function AssetRiskDetailError({
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
      <h2 className="text-xl font-bold text-white">Error loading asset risk profile</h2>
      <p className="text-sm text-slate-400">
        {error.message || "An unexpected error occurred while fetching the asset risk details."}
      </p>
      <div className="pt-2 flex justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="px-4 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow transition-colors"
        >
          Try Again
        </button>
        <Link
          href="/asset-risk"
          className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
        >
          Back to Asset List
        </Link>
      </div>
    </div>
  );
}
