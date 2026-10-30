"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface DashboardHeaderProps {
  organizationName: string;
  basis: "residual" | "inherent";
  generatedAt: string;
  userRole: string;
}

export function DashboardHeader({
  organizationName,
  basis,
  generatedAt,
  userRole,
}: DashboardHeaderProps) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canTakeSnapshot = userRole === "admin" || userRole === "assessor";

  const handleTakeSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim() || undefined }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to create assessment snapshot");
      }

      setModalOpen(false);
      setLabel("");
      router.refresh();
    } catch (err: unknown) {
      setErrorMsg((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const formattedDate = new Date(generatedAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-white tracking-tight">Executive Dashboard</h1>
            <span className="text-xs bg-slate-800 border border-slate-700 text-slate-300 px-2 py-0.5 rounded-full font-medium">
              {organizationName}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1" suppressHydrationWarning>
            Real-time organizational risk posture, threat vectors, control implementation and trends • Generated {formattedDate}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Basis Toggle: Residual | Inherent */}
          <div className="inline-flex rounded-lg bg-slate-900 border border-slate-800 p-0.5" role="group" aria-label="Risk evaluation basis">
            <Link
              href="/dashboard?basis=residual"
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                basis === "residual"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Residual Basis
            </Link>
            <Link
              href="/dashboard?basis=inherent"
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                basis === "inherent"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Inherent Basis
            </Link>
          </div>

          {/* Take Snapshot Button (Admin/Assessor) */}
          {canTakeSnapshot && (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-700/50 shadow transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <span>📷</span>
              <span>Take Snapshot</span>
            </button>
          )}
        </div>
      </div>

      {/* Modal Dialog */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="snapshot-modal-title"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 id="snapshot-modal-title" className="text-base font-bold text-white">
                Create Assessment Snapshot
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Capturing a snapshot records the current state of all active organizational risks and scores as an immutable milestone for trend reporting.
            </p>

            {errorMsg && (
              <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-lg text-xs text-rose-300">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleTakeSnapshot} className="space-y-4">
              <div>
                <label htmlFor="snapshot-label" className="block text-xs font-semibold text-slate-300 mb-1">
                  Snapshot Label (Optional)
                </label>
                <input
                  id="snapshot-label"
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Q4 2026 Executive Review Baseline"
                  maxLength={80}
                  disabled={loading}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={loading}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow transition-colors disabled:opacity-50"
                >
                  {loading ? "Capturing..." : "Confirm & Save Snapshot"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
