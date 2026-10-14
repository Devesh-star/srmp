"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function AssessmentsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center max-w-md mx-auto my-12 space-y-4">
      <div className="w-12 h-12 rounded-full bg-rose-950/80 border border-rose-800 text-rose-400 flex items-center justify-center mx-auto text-xl font-bold">
        !
      </div>
      <h2 className="text-lg font-bold text-white">Something went wrong</h2>
      <p className="text-xs text-slate-400">
        {error.message || "An unexpected error occurred while loading assessment snapshots."}
      </p>
      <div className="flex justify-center space-x-3 pt-2">
        <button
          type="button"
          onClick={() => reset()}
          className="px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
        >
          Try Again
        </button>
        <Link
          href="/risks"
          className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
        >
          Back to Risks
        </Link>
      </div>
    </div>
  );
}
