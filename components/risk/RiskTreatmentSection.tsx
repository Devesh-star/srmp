"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { RiskDTO } from "@/services/riskService";
import { computeResidual, roundTo, level } from "@/lib/riskEngine";

interface RiskTreatmentSectionProps {
  risk: RiskDTO;
  userRole: string;
}

export function RiskTreatmentSection({
  risk,
  userRole,
}: RiskTreatmentSectionProps) {
  const router = useRouter();
  const [treatment, setTreatment] = useState<"mitigate" | "accept" | "transfer" | "avoid">(
    risk.treatment as "mitigate" | "accept" | "transfer" | "avoid"
  );

  // Accept fields
  const [acceptJustification, setAcceptJustification] = useState(
    risk.treatmentDetails?.justification ?? ""
  );
  const [acceptApprover, setAcceptApprover] = useState(
    risk.treatmentDetails?.approver ?? ""
  );
  const [acceptReviewDate, setAcceptReviewDate] = useState(
    risk.treatmentDetails?.reviewDate ?? ""
  );

  // Transfer fields
  const [transferJustification, setTransferJustification] = useState(
    risk.treatmentDetails?.justification ?? ""
  );
  const [transferFactor, setTransferFactor] = useState(
    risk.treatmentDetails?.transferFactor ?? 0.4
  );
  const [transferReviewDate, setTransferReviewDate] = useState(
    risk.treatmentDetails?.reviewDate ?? ""
  );

  // Avoid fields
  const [avoidReason, setAvoidReason] = useState(
    risk.treatmentDetails?.avoidReason ?? ""
  );

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isStaleConflict, setIsStaleConflict] = useState(false);

  const isAdmin = userRole === "admin";
  const isAssessorOrAdmin = userRole === "admin" || userRole === "assessor";
  const isCriticalInherent = risk.inherentLevel === "Critical";
  const canAccept = isAssessorOrAdmin && (!isCriticalInherent || isAdmin);

  // Live residual calculation using pure engine function
  const livePreview = useMemo(() => {
    if (treatment === "avoid") {
      return { likelihood: 0, impact: 0, score: 0, level: "Low" };
    }

    const engineControls = risk.controls.map((c) => ({
      id: c.key,
      effectiveness: c.effectiveness,
      reduces: c.reduces,
      status: c.status,
    }));

    const result = computeResidual({
      likelihood: risk.likelihood,
      impact: risk.impact,
      treatment,
      controls: engineControls,
      transferFactor: treatment === "transfer" ? transferFactor : undefined,
    });

    return {
      likelihood: result.likelihood,
      impact: result.impact,
      score: result.score,
      level: level(result.score),
    };
  }, [treatment, transferFactor, risk.likelihood, risk.impact, risk.controls]);

  const executeSave = async () => {
    setLoading(true);
    setErrorMsg(null);
    setIsStaleConflict(false);

    try {
      let payload: Record<string, unknown> = {
        treatment,
        expectedUpdatedAt: risk.updatedAt,
      };

      if (treatment === "accept") {
        if (!acceptJustification.trim() || !acceptApprover.trim() || !acceptReviewDate) {
          throw new Error("Justification, approver, and review date are all required for Risk Acceptance.");
        }
        payload = {
          ...payload,
          justification: acceptJustification.trim(),
          approver: acceptApprover.trim(),
          reviewDate: acceptReviewDate,
        };
      } else if (treatment === "transfer") {
        if (!transferJustification.trim()) {
          throw new Error("Transfer justification is required.");
        }
        payload = {
          ...payload,
          justification: transferJustification.trim(),
          transferFactor,
          reviewDate: transferReviewDate || null,
        };
      } else if (treatment === "avoid") {
        if (avoidReason.trim().length < 10) {
          throw new Error("Avoid reason must be at least 10 characters long.");
        }
        payload = {
          ...payload,
          avoidReason: avoidReason.trim(),
        };
      }

      const res = await fetch(`/api/risks/${risk.riskId}/treatment`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        if (res.status === 409) {
          setIsStaleConflict(true);
          throw new Error(data.message || "Conflict: Stale update.");
        }
        throw new Error(data.message || "Failed to update risk treatment.");
      }

      setIsConfirmModalOpen(false);
      router.refresh();
    } catch (err: unknown) {
      setErrorMsg((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (treatment === "accept" || treatment === "avoid") {
      setIsConfirmModalOpen(true);
    } else {
      executeSave();
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
      <div className="border-b border-slate-800 pb-4">
        <h2 className="text-lg font-semibold text-white">Risk Treatment Strategy</h2>
        <p className="text-xs text-slate-400">
          Select one of the four risk treatment strategies and configure its parameters.
        </p>
      </div>

      {isStaleConflict && (
        <div className="p-4 bg-amber-950/80 border border-amber-700 rounded-lg flex items-center justify-between text-xs text-amber-200">
          <span>This risk was modified by another user. Reload to continue.</span>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="px-3 py-1 bg-amber-600 hover:bg-amber-500 font-semibold text-white rounded transition-colors"
          >
            Reload Page
          </button>
        </div>
      )}

      {errorMsg && !isStaleConflict && (
        <div className="p-3 bg-rose-950/70 border border-rose-800 rounded-lg text-xs text-rose-300">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Treatment Radio Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" role="radiogroup" aria-label="Risk Treatment Selection">
          {/* Mitigate */}
          <label
            className={`cursor-pointer rounded-xl border p-4 flex flex-col justify-between transition-all ${
              treatment === "mitigate"
                ? "bg-slate-800/90 border-indigo-500 ring-2 ring-indigo-500/20"
                : "bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-400"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm text-white">Mitigate</span>
                <input
                  type="radio"
                  name="treatment"
                  value="mitigate"
                  checked={treatment === "mitigate"}
                  onChange={() => setTreatment("mitigate")}
                  disabled={!isAssessorOrAdmin || loading}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Implement technical & operational controls to lower likelihood and/or impact.
              </p>
            </div>
          </label>

          {/* Accept */}
          <label
            className={`cursor-pointer rounded-xl border p-4 flex flex-col justify-between transition-all ${
              treatment === "accept"
                ? "bg-slate-800/90 border-indigo-500 ring-2 ring-indigo-500/20"
                : "bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-400"
            } ${!canAccept ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm text-white">Accept</span>
                <input
                  type="radio"
                  name="treatment"
                  value="accept"
                  checked={treatment === "accept"}
                  onChange={() => canAccept && setTreatment("accept")}
                  disabled={!canAccept || loading}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Formally acknowledge and retain residual risk with governance approval.
              </p>
              {isCriticalInherent && !isAdmin && (
                <span className="mt-2 block text-[11px] text-amber-400 font-semibold">
                  ⚠️ Only an admin can accept a Critical risk
                </span>
              )}
            </div>
          </label>

          {/* Transfer */}
          <label
            className={`cursor-pointer rounded-xl border p-4 flex flex-col justify-between transition-all ${
              treatment === "transfer"
                ? "bg-slate-800/90 border-indigo-500 ring-2 ring-indigo-500/20"
                : "bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-400"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm text-white">Transfer</span>
                <input
                  type="radio"
                  name="treatment"
                  value="transfer"
                  checked={treatment === "transfer"}
                  onChange={() => setTreatment("transfer")}
                  disabled={!isAssessorOrAdmin || loading}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Shift impact to a third party (e.g. cyber insurance or ISP SLA).
              </p>
            </div>
          </label>

          {/* Avoid */}
          <label
            className={`cursor-pointer rounded-xl border p-4 flex flex-col justify-between transition-all ${
              treatment === "avoid"
                ? "bg-slate-800/90 border-indigo-500 ring-2 ring-indigo-500/20"
                : "bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-400"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm text-white">Avoid</span>
                <input
                  type="radio"
                  name="treatment"
                  value="avoid"
                  checked={treatment === "avoid"}
                  onChange={() => setTreatment("avoid")}
                  disabled={!isAssessorOrAdmin || loading}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Cease the vulnerable activity or decommission the asset to eliminate the risk.
              </p>
            </div>
          </label>
        </div>

        {/* Conditional Fields */}
        {treatment === "accept" && (
          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Risk Acceptance Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label htmlFor="accept-justification" className="block text-xs font-semibold text-slate-300 mb-1">
                  Business Justification (10–1000 characters) *
                </label>
                <textarea
                  id="accept-justification"
                  rows={3}
                  value={acceptJustification}
                  onChange={(e) => setAcceptJustification(e.target.value)}
                  placeholder="Explain why mitigation is impractical or cost-prohibitive..."
                  disabled={!isAssessorOrAdmin || loading}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="accept-approver" className="block text-xs font-semibold text-slate-300 mb-1">
                  Approving Officer / Authority *
                </label>
                <input
                  id="accept-approver"
                  type="text"
                  value={acceptApprover}
                  onChange={(e) => setAcceptApprover(e.target.value)}
                  placeholder="e.g. CISO / Risk Committee"
                  disabled={!isAssessorOrAdmin || loading}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="accept-review-date" className="block text-xs font-semibold text-slate-300 mb-1">
                  Mandatory Review Date (within 2 years) *
                </label>
                <input
                  id="accept-review-date"
                  type="date"
                  value={acceptReviewDate}
                  onChange={(e) => setAcceptReviewDate(e.target.value)}
                  disabled={!isAssessorOrAdmin || loading}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>
            </div>
          </div>
        )}

        {treatment === "transfer" && (
          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Risk Transfer Details</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="transfer-justification" className="block text-xs font-semibold text-slate-300 mb-1">
                  Transfer Justification (10–1000 characters) *
                </label>
                <textarea
                  id="transfer-justification"
                  rows={3}
                  value={transferJustification}
                  onChange={(e) => setTransferJustification(e.target.value)}
                  placeholder="Describe policy, indemnity contract, or vendor agreement..."
                  disabled={!isAssessorOrAdmin || loading}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label htmlFor="transfer-factor" className="block text-xs font-semibold text-slate-300">
                      Transfer Factor (Impact Reduction)
                    </label>
                    <span className="text-xs font-mono font-bold text-indigo-400">
                      {Math.round(transferFactor * 100)}%
                    </span>
                  </div>
                  <input
                    id="transfer-factor"
                    type="range"
                    min="0.05"
                    max="0.90"
                    step="0.05"
                    value={transferFactor}
                    onChange={(e) => setTransferFactor(parseFloat(e.target.value))}
                    disabled={!isAssessorOrAdmin || loading}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                  <span className="text-[11px] text-slate-400">
                    Reduces residual impact by {Math.round(transferFactor * 100)}%.
                  </span>
                </div>

                <div>
                  <label htmlFor="transfer-review-date" className="block text-xs font-semibold text-slate-300 mb-1">
                    Contract / Policy Renewal Date (optional)
                  </label>
                  <input
                    id="transfer-review-date"
                    type="date"
                    value={transferReviewDate}
                    onChange={(e) => setTransferReviewDate(e.target.value)}
                    disabled={!isAssessorOrAdmin || loading}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {treatment === "avoid" && (
          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-5 space-y-3">
            <h3 className="text-sm font-semibold text-white">Risk Avoidance Rationale</h3>
            <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-lg text-xs text-amber-300">
              ⚠️ <strong>Warning:</strong> Avoiding this risk closes it automatically (status = Closed) and removes it from the default risk matrix and assessment snapshots.
            </div>
            <div>
              <label htmlFor="avoid-reason" className="block text-xs font-semibold text-slate-300 mb-1">
                Avoidance Rationale (min 10 characters) *
              </label>
              <textarea
                id="avoid-reason"
                rows={3}
                value={avoidReason}
                onChange={(e) => setAvoidReason(e.target.value)}
                placeholder="Detail the termination of activity or system decommission..."
                disabled={!isAssessorOrAdmin || loading}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                required
              />
            </div>
          </div>
        )}

        {/* Live Preview Box */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <span className="text-xs font-bold uppercase text-slate-400">Live Projected Residual:</span>
            <div className="flex items-baseline space-x-2">
              <span className="text-xl font-extrabold text-white">{roundTo(livePreview.score, 1)}</span>
              <span className="text-xs text-slate-400">/ 25</span>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-200 font-semibold">
              {livePreview.level}
            </span>
          </div>

          {isAssessorOrAdmin && (
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto px-5 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg transition-colors disabled:opacity-50"
            >
              {loading ? "Saving Strategy..." : "Save Treatment Strategy"}
            </button>
          )}
        </div>
      </form>

      {/* Confirmation Dialog for Avoid and Accept */}
      {isConfirmModalOpen && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="treatment-confirm-title"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h2 id="treatment-confirm-title" className="text-lg font-bold text-white">
              Confirm {treatment === "accept" ? "Risk Acceptance" : "Risk Avoidance"}
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              {treatment === "accept"
                ? `You are about to accept this risk with residual score ${roundTo(
                    livePreview.score,
                    1
                  )}. This formal acceptance will be recorded in the audit log.`
                : "You are setting the treatment to Avoid. This will automatically close the risk and exclude it from future snapshots and the active matrix."}
            </p>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                disabled={loading}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeSave}
                disabled={loading}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
              >
                {loading ? "Applying..." : "Confirm & Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
