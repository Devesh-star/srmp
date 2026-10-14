"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { RiskDTO, RiskDTOControl } from "@/services/riskService";

export interface LibraryControlOption {
  key: string;
  name: string;
  category: string;
  reduces: "likelihood" | "impact";
  effectiveness: number;
  implementationCost: string;
  isRecommended?: boolean;
}

interface RiskControlsSectionProps {
  risk: RiskDTO;
  userRole: string;
  availableControls: LibraryControlOption[];
}

export function RiskControlsSection({
  risk,
  userRole,
  availableControls,
}: RiskControlsSectionProps) {
  const router = useRouter();
  const [controls, setControls] = useState<RiskDTOControl[]>(risk.controls || []);
  const [selectedKey, setSelectedKey] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isStaleConflict, setIsStaleConflict] = useState(false);

  const canEdit =
    (userRole === "admin" || userRole === "assessor") &&
    risk.treatment === "mitigate" &&
    risk.status !== "Closed";

  const attachedKeySet = new Set(controls.map((c) => c.key));

  const unattachedOptions = availableControls
    .filter((c) => !attachedKeySet.has(c.key))
    .filter(
      (c) =>
        c.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        c.key.toLowerCase().includes(searchFilter.toLowerCase())
    );

  const recommendedOptions = unattachedOptions.filter((c) => c.isRecommended);
  const otherOptions = unattachedOptions.filter((c) => !c.isRecommended);

  const saveControls = async (newControlsList: RiskDTOControl[]) => {
    setLoading(true);
    setErrorMsg(null);
    setIsStaleConflict(false);

    try {
      const payload = {
        controls: newControlsList.map((c) => ({
          controlKey: c.key,
          status: c.status,
        })),
        expectedUpdatedAt: risk.updatedAt,
      };

      const res = await fetch(`/api/risks/${risk.riskId}/controls`, {
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
        throw new Error(data.message || "Failed to update controls.");
      }

      const updated = await res.json();
      setControls(updated.controls);
      router.refresh();
    } catch (err: unknown) {
      setErrorMsg((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (key: string, newStatus: "planned" | "implemented") => {
    const updated = controls.map((c) =>
      c.key === key ? { ...c, status: newStatus } : c
    );
    setControls(updated);
    saveControls(updated);
  };

  const handleRemove = (key: string) => {
    const updated = controls.filter((c) => c.key !== key);
    setControls(updated);
    saveControls(updated);
  };

  const handleAddControl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKey) return;

    const opt = availableControls.find((c) => c.key === selectedKey);
    if (!opt) return;

    const newCtl: RiskDTOControl = {
      key: opt.key,
      name: opt.name,
      category: opt.category,
      reduces: opt.reduces,
      effectiveness: opt.effectiveness,
      implementationCost: opt.implementationCost,
      status: "planned",
      implementedAt: null,
    };

    const updated = [...controls, newCtl];
    setControls(updated);
    setSelectedKey("");
    saveControls(updated);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Security Controls</h2>
          <p className="text-xs text-slate-400">
            Attached mitigation controls ({controls.filter((c) => c.status === "implemented").length} of {controls.length} implemented).
          </p>
        </div>

        {risk.treatment !== "mitigate" && (
          <span className="text-xs px-2.5 py-1 rounded-md bg-amber-950/60 border border-amber-800/80 text-amber-300">
            Controls are ignored under {risk.treatment} treatment
          </span>
        )}
      </div>

      {isStaleConflict && (
        <div className="p-4 bg-amber-950/80 border border-amber-700 rounded-lg flex items-center justify-between text-xs text-amber-200">
          <span>This risk was modified by another user. Please reload to see the latest changes.</span>
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

      {/* Controls Table */}
      {controls.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-slate-800 rounded-lg text-slate-400 text-xs">
          No security controls currently attached to this risk.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                <th className="py-2.5 px-3">Control</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Reduces</th>
                <th className="py-2.5 px-3 text-right">Effectiveness</th>
                <th className="py-2.5 px-3">Cost</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Implemented Date</th>
                {canEdit && <th className="py-2.5 px-3 text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {controls.map((c) => (
                <tr key={c.key} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-3">
                    <span className="font-semibold text-white block">{c.name}</span>
                    <span className="text-[11px] font-mono text-slate-400">{c.key}</span>
                  </td>
                  <td className="py-3 px-3">{c.category}</td>
                  <td className="py-3 px-3 capitalize">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                        c.reduces === "likelihood"
                          ? "bg-indigo-950 text-indigo-300 border border-indigo-800"
                          : "bg-emerald-950 text-emerald-300 border border-emerald-800"
                      }`}
                    >
                      {c.reduces}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-semibold text-slate-200">
                    {Math.round(c.effectiveness * 100)}%
                  </td>
                  <td className="py-3 px-3">{c.implementationCost}</td>
                  <td className="py-3 px-3">
                    {canEdit ? (
                      <select
                        aria-label={`Status for ${c.name}`}
                        value={c.status}
                        onChange={(e) =>
                          handleStatusChange(
                            c.key,
                            e.target.value as "planned" | "implemented"
                          )
                        }
                        disabled={loading}
                        className={`text-xs px-2.5 py-1 rounded border font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                          c.status === "implemented"
                            ? "bg-emerald-950 text-emerald-300 border-emerald-700"
                            : "bg-slate-800 text-amber-300 border-slate-700"
                        }`}
                      >
                        <option value="planned">Planned</option>
                        <option value="implemented">Implemented</option>
                      </select>
                    ) : (
                      <span
                        className={`px-2.5 py-0.5 rounded-full border text-[11px] font-semibold ${
                          c.status === "implemented"
                            ? "bg-emerald-950/80 text-emerald-300 border-emerald-700"
                            : "bg-slate-800 text-amber-300 border-slate-700"
                        }`}
                      >
                        {c.status}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-slate-400 text-[11px]">
                    {c.implementedAt
                      ? new Date(c.implementedAt).toLocaleDateString()
                      : "—"}
                  </td>
                  {canEdit && (
                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemove(c.key)}
                        disabled={loading}
                        className="text-slate-400 hover:text-rose-400 transition-colors p-1"
                        aria-label={`Remove ${c.name}`}
                      >
                        ✕
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Control Picker */}
      {canEdit && (
        <form onSubmit={handleAddControl} className="border-t border-slate-800 pt-4 flex flex-col sm:flex-row gap-3">
          <div className="flex-1 flex gap-2">
            <input
              type="text"
              placeholder="Search library controls..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-1/3 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <select
              aria-label="Select control to attach"
              value={selectedKey}
              onChange={(e) => setSelectedKey(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">-- Choose a control to attach --</option>
              {recommendedOptions.length > 0 && (
                <optgroup label="⭐ Recommended for this Vulnerability">
                  {recommendedOptions.map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      ⭐ {opt.name} ({Math.round(opt.effectiveness * 100)}% {opt.reduces})
                    </option>
                  ))}
                </optgroup>
              )}
              {otherOptions.length > 0 && (
                <optgroup label="All Other Controls">
                  {otherOptions.map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      {opt.name} ({Math.round(opt.effectiveness * 100)}% {opt.reduces})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          <button
            type="submit"
            disabled={loading || !selectedKey}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50"
          >
            {loading ? "Saving..." : "Add Control"}
          </button>
        </form>
      )}
    </div>
  );
}
