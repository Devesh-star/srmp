"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { RiskDTO } from "@/services/riskService";

interface RiskStatusHeaderProps {
  risk: RiskDTO;
  userRole: string;
}

export function RiskStatusHeader({ risk, userRole }: RiskStatusHeaderProps) {
  const router = useRouter();
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [closeReason, setCloseReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isAssessorOrAdmin = userRole === "admin" || userRole === "assessor";

  // Check if review date is overdue
  let isOverdue = false;
  if (
    (risk.treatment === "accept" || risk.treatment === "transfer") &&
    risk.treatmentDetails?.reviewDate
  ) {
    const today = new Date().toISOString().split("T")[0];
    isOverdue = risk.treatmentDetails.reviewDate < today;
  }

  const handleClose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (closeReason.trim().length < 10) {
      setErrorMsg("Close reason must be at least 10 characters long.");
      return;
    }
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/risks/${risk.riskId}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: closeReason.trim(),
          expectedUpdatedAt: risk.updatedAt,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to close risk");
      }

      setIsCloseModalOpen(false);
      router.refresh();
    } catch (err: unknown) {
      setErrorMsg((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleReopen = async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/risks/${risk.riskId}/reopen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedUpdatedAt: risk.updatedAt,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to reopen risk");
      }

      router.refresh();
    } catch (err: unknown) {
      setErrorMsg((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Open":
        return "bg-rose-950/80 text-rose-300 border-rose-700";
      case "In Treatment":
        return "bg-amber-950/80 text-amber-300 border-amber-700";
      case "Mitigated":
        return "bg-emerald-950/80 text-emerald-300 border-emerald-700";
      case "Accepted":
        return "bg-indigo-950/80 text-indigo-300 border-indigo-700";
      case "Closed":
        return "bg-slate-800 text-slate-400 border-slate-600";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-indigo-300">
              {risk.riskId}
            </span>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              {risk.threat.name} on {risk.asset.name}
            </h1>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${getStatusBadge(
                risk.status
              )}`}
            >
              {risk.status}
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Asset: <strong className="text-slate-200">{risk.asset.name}</strong> ({risk.asset.type}) • Vulnerability:{" "}
            <strong className="text-slate-200">{risk.vulnerability.name}</strong>
          </p>
        </div>

        {/* Action buttons */}
        {isAssessorOrAdmin && (
          <div className="flex items-center space-x-3">
            {risk.status !== "Closed" && (
              <button
                type="button"
                onClick={() => setIsCloseModalOpen(true)}
                disabled={loading}
                className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white transition-colors"
              >
                Close Risk
              </button>
            )}

            {risk.closedManually && (
              <button
                type="button"
                onClick={handleReopen}
                disabled={loading}
                className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition-colors"
              >
                {loading ? "Reopening..." : "Reopen Risk"}
              </button>
            )}
          </div>
        )}
      </div>

      {isOverdue && (
        <div className="p-3 bg-rose-950/50 border border-rose-800/80 rounded-lg text-xs text-rose-300 flex items-center space-x-2">
          <span className="font-bold">⚠️ Review Overdue:</span>
          <span>
            The scheduled review date for this accepted/transferred risk ({risk.treatmentDetails?.reviewDate}) has passed.
          </span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-lg text-xs text-rose-200">
          {errorMsg}
        </div>
      )}

      {/* Close Risk Dialog */}
      {isCloseModalOpen && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="close-dialog-title"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h2 id="close-dialog-title" className="text-lg font-bold text-white">
              Close Risk {risk.riskId}
            </h2>
            <p className="text-xs text-slate-400">
              Provide a clear operational rationale for closing this risk. This reason will be permanently recorded in the audit trail.
            </p>

            <form onSubmit={handleClose} className="space-y-4">
              <div>
                <label htmlFor="close-reason" className="block text-xs font-semibold text-slate-300 mb-1">
                  Reason for closure (min 10 characters) *
                </label>
                <textarea
                  id="close-reason"
                  rows={3}
                  value={closeReason}
                  onChange={(e) => setCloseReason(e.target.value)}
                  placeholder="e.g. Asset decommissioned and removed from service inventory..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              {errorMsg && <p className="text-xs text-rose-400">{errorMsg}</p>}

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCloseModalOpen(false)}
                  disabled={loading}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || closeReason.trim().length < 10}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition-colors disabled:opacity-50"
                >
                  {loading ? "Closing..." : "Confirm Close"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
