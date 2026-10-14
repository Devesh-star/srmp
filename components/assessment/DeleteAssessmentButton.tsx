"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

interface DeleteAssessmentButtonProps {
  id: string;
  label: string;
  userRole: string;
}

export function DeleteAssessmentButton({
  id,
  label,
  userRole,
}: DeleteAssessmentButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (userRole !== "admin") return null;

  const handleDelete = async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/assessments/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to delete assessment");
      }

      router.push("/assessments");
      router.refresh();
    } catch (err: unknown) {
      setErrorMsg((err as Error).message);
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 hover:text-white transition-colors"
      >
        Delete Snapshot
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-confirm-title"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h2 id="delete-confirm-title" className="text-lg font-bold text-white">
              Delete Snapshot &quot;{label}&quot;?
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Are you sure you want to permanently delete this assessment snapshot? This action cannot be undone and will be logged in the audit trail.
            </p>

            {errorMsg && <p className="text-xs text-rose-400">{errorMsg}</p>}

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={loading}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition-colors"
              >
                {loading ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
