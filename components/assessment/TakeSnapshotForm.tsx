"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

interface TakeSnapshotFormProps {
  userRole: string;
}

export function TakeSnapshotForm({ userRole }: TakeSnapshotFormProps) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const canCreate = userRole === "admin" || userRole === "assessor";

  if (!canCreate) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to create assessment snapshot");
      }

      const created = await res.json();
      setSuccessMsg(`Snapshot "${created.label}" taken successfully!`);
      setLabel("");
      router.refresh();
    } catch (err: unknown) {
      setErrorMsg((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
      <div className="border-b border-slate-800 pb-3">
        <h2 className="text-base font-semibold text-white">Capture Assessment Snapshot</h2>
        <p className="text-xs text-slate-400">
          Create an immutable point-in-time baseline snapshot of all active (non-Closed) organizational risks.
        </p>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-700 rounded-lg text-xs text-emerald-300">
          ✓ {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-lg text-xs text-rose-300">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Snapshot label (optional, e.g. Q4 2026 Audit Baseline)"
          maxLength={80}
          disabled={loading}
          className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />

        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {loading ? "Capturing..." : "Take Snapshot"}
        </button>
      </form>
    </div>
  );
}
