"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { level, inherentScore } from "@/lib/riskEngine";
import { getLevelBadgeClasses } from "@/lib/ui/levelStyles";

interface ThreatOption {
  key: string;
  name: string;
  category: string;
  ciaTarget: "C" | "I" | "A";
  description: string;
}

interface VulnerabilityOption {
  key: string;
  name: string;
  severity: string;
  description: string;
}

interface AssetOption {
  id: string;
  name: string;
  type: string;
  owner: string;
  confidentiality: number;
  integrity: number;
  availability: number;
  criticality: number;
}

interface CreateRiskModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedAssetId?: string;
  onSuccess?: (createdRisk: { riskId: string }) => void;
}

export function CreateRiskModal({
  isOpen,
  onClose,
  preselectedAssetId,
  onSuccess,
}: CreateRiskModalProps) {
  const router = useRouter();

  // Assets list
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string>(preselectedAssetId || "");
  const [assetsLoading, setAssetsLoading] = useState(false);

  // Cascading Threats & Vulnerabilities
  const [threats, setThreats] = useState<ThreatOption[]>([]);
  const [selectedThreatKey, setSelectedThreatKey] = useState<string>("");
  const [threatsLoading, setThreatsLoading] = useState(false);

  const [vulnerabilities, setVulnerabilities] = useState<VulnerabilityOption[]>([]);
  const [selectedVulKey, setSelectedVulKey] = useState<string>("");
  const [vulLoading, setVulLoading] = useState(false);

  // Scoring
  const [likelihood, setLikelihood] = useState<number>(3);
  const [customImpact, setCustomImpact] = useState<number | null>(null);

  // Metadata
  const [owner, setOwner] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load assets on open
  useEffect(() => {
    if (!isOpen) return;
    async function loadAssets() {
      setAssetsLoading(true);
      try {
        const res = await fetch("/api/assets?limit=100");
        if (res.ok) {
          const data = await res.json();
          setAssets(data.items || []);
          if (!selectedAssetId && data.items && data.items.length > 0) {
            setSelectedAssetId(preselectedAssetId || data.items[0].id);
          }
        }
      } catch {
        // Ignore load error
      } finally {
        setAssetsLoading(false);
      }
    }
    loadAssets();
  }, [isOpen, preselectedAssetId, selectedAssetId]);

  // Selected asset object
  const activeAsset = useMemo(
    () => assets.find((a) => a.id === selectedAssetId),
    [assets, selectedAssetId]
  );

  // Fetch cascading threats when asset changes
  useEffect(() => {
    if (!activeAsset) return;

    let ignore = false;
    async function loadThreats() {
      setThreatsLoading(true);
      try {
        const res = await fetch(`/api/cascade?assetType=${encodeURIComponent(activeAsset!.type)}`);
        if (res.ok && !ignore) {
          const data: ThreatOption[] = await res.json();
          setThreats(data || []);
          if (data && data.length > 0) {
            setSelectedThreatKey(data[0].key);
          } else {
            setSelectedThreatKey("");
          }
        }
      } catch {
        if (!ignore) {
          setThreats([]);
          setSelectedThreatKey("");
        }
      } finally {
        if (!ignore) {
          setThreatsLoading(false);
        }
      }
    }

    loadThreats();
    return () => {
      ignore = true;
    };
  }, [activeAsset]);

  // Selected threat object
  const activeThreat = useMemo(
    () => threats.find((t) => t.key === selectedThreatKey),
    [threats, selectedThreatKey]
  );

  // Fetch cascading vulnerabilities when threat changes
  useEffect(() => {
    if (!activeAsset || !activeThreat) return;

    let ignore = false;
    async function loadVulnerabilities() {
      setVulLoading(true);
      try {
        const res = await fetch(
          `/api/cascade?assetType=${encodeURIComponent(activeAsset!.type)}&threatKey=${encodeURIComponent(
            activeThreat!.key
          )}`
        );
        if (res.ok && !ignore) {
          const data: VulnerabilityOption[] = await res.json();
          setVulnerabilities(data || []);
          if (data && data.length > 0) {
            setSelectedVulKey(data[0].key);
          } else {
            setSelectedVulKey("");
          }
        }
      } catch {
        if (!ignore) {
          setVulnerabilities([]);
          setSelectedVulKey("");
        }
      } finally {
        if (!ignore) {
          setVulLoading(false);
        }
      }
    }

    loadVulnerabilities();
    return () => {
      ignore = true;
    };
  }, [activeAsset, activeThreat]);

  // Calculate suggested impact from Asset CIA & Threat ciaTarget
  const suggestedImpact = useMemo(() => {
    if (!activeAsset || !activeThreat) return 3;
    switch (activeThreat.ciaTarget) {
      case "C":
        return activeAsset.confidentiality;
      case "I":
        return activeAsset.integrity;
      case "A":
        return activeAsset.availability;
      default:
        return 3;
    }
  }, [activeAsset, activeThreat]);

  const impact = customImpact !== null ? customImpact : suggestedImpact;
  const isImpactOverridden = customImpact !== null && customImpact !== suggestedImpact;
  const effectiveOwner = owner.trim() ? owner : activeAsset?.owner || "";

  // Real-time pure scoring using riskEngine functions
  const calculatedScore = inherentScore(likelihood, impact);
  const calculatedLevel = level(calculatedScore);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetId) {
      setError("Please select an asset.");
      return;
    }
    if (!selectedThreatKey) {
      setError("Please select an applicable threat.");
      return;
    }
    if (!selectedVulKey) {
      setError("Please select a vulnerability.");
      return;
    }
    const finalOwner = effectiveOwner.trim();
    if (!finalOwner) {
      setError("Please enter a risk owner.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        assetId: selectedAssetId,
        threatKey: selectedThreatKey,
        vulnerabilityKey: selectedVulKey,
        likelihood,
        impact,
        owner: finalOwner,
        notes: notes.trim(),
      };
      if (dueDate) {
        payload.dueDate = dueDate;
      }

      const res = await fetch("/api/risks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to create risk assessment.");
      }

      const created = await res.json();
      router.refresh();
      onClose();
      if (onSuccess) {
        onSuccess(created);
      } else {
        router.push(`/risks/${created.riskId}`);
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-risk-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 text-white max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h2 id="create-risk-title" className="text-lg font-semibold tracking-tight text-white">
              Perform New Risk Assessment
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Identify threats, vulnerabilities, and assess inherent likelihood and impact.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-rose-950/60 border border-rose-800 rounded-lg text-rose-300 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* 1. Asset Selection */}
          <div>
            <label htmlFor="risk-asset" className="block text-xs font-medium text-slate-300 mb-1">
              Target Asset *
            </label>
            <select
              id="risk-asset"
              required
              disabled={assetsLoading || assets.length === 0}
              value={selectedAssetId}
              onChange={(e) => {
                setSelectedAssetId(e.target.value);
                setCustomImpact(null);
                setOwner("");
              }}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.type} — Tier {a.criticality})
                </option>
              ))}
            </select>
            {activeAsset && (
              <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-400">
                <span>
                  CIA Profile: C:{" "}
                  <strong className="text-indigo-400">{activeAsset.confidentiality}</strong> | I:{" "}
                  <strong className="text-indigo-400">{activeAsset.integrity}</strong> | A:{" "}
                  <strong className="text-indigo-400">{activeAsset.availability}</strong>
                </span>
                <span>•</span>
                <span>
                  Owner: <strong className="text-slate-300">{activeAsset.owner}</strong>
                </span>
              </div>
            )}
          </div>

          {/* 2. Threat & Vulnerability Cascade */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="risk-threat" className="block text-xs font-medium text-slate-300 mb-1">
                Threat (Cascaded by Asset Type) *
              </label>
              <select
                id="risk-threat"
                required
                disabled={threatsLoading || threats.length === 0}
                value={selectedThreatKey}
                onChange={(e) => {
                  setSelectedThreatKey(e.target.value);
                  setCustomImpact(null);
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-ellipsis overflow-hidden"
              >
                {threats.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.name} [{t.ciaTarget}]
                  </option>
                ))}
              </select>
              {activeThreat && (
                <p className="mt-1 text-[11px] text-slate-400 line-clamp-1">
                  Target: {activeThreat.ciaTarget} | Category: {activeThreat.category}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="risk-vul" className="block text-xs font-medium text-slate-300 mb-1">
                Vulnerability (Linked) *
              </label>
              <select
                id="risk-vul"
                required
                disabled={vulLoading || vulnerabilities.length === 0}
                value={selectedVulKey}
                onChange={(e) => setSelectedVulKey(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-ellipsis overflow-hidden"
              >
                {vulnerabilities.map((v) => (
                  <option key={v.key} value={v.key}>
                    {v.name} ({v.severity})
                  </option>
                ))}
              </select>
              {vulnerabilities.length === 0 && !vulLoading && (
                <p className="mt-1 text-[11px] text-amber-400">
                  No vulnerabilities mapped for this threat.
                </p>
              )}
            </div>
          </div>

          {/* 3. Scoring & Suggested Impact */}
          <div className="p-4 bg-slate-800/60 border border-slate-700/80 rounded-lg space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-200">
                Inherent Risk Scoring (Pure Engine)
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-300">
                  Score: <strong className="text-white">{calculatedScore}</strong> / 25
                </span>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${getLevelBadgeClasses(
                    calculatedLevel
                  )}`}
                >
                  {calculatedLevel}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* Likelihood */}
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>Likelihood (L):</span>
                  <span className="font-semibold text-indigo-400">{likelihood} / 5</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={likelihood}
                  onChange={(e) => setLikelihood(Number(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                  <span>1 - Rare</span>
                  <span>3 - Moderate</span>
                  <span>5 - Almost Certain</span>
                </div>
              </div>

              {/* Impact */}
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <div className="flex items-center gap-1.5">
                    <span>Impact (I):</span>
                    {!isImpactOverridden && (
                      <span className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800 px-1.5 py-0.2 rounded">
                        Suggested by CIA
                      </span>
                    )}
                  </div>
                  <span className="font-semibold text-indigo-400">{impact} / 5</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={impact}
                  onChange={(e) => {
                    setCustomImpact(Number(e.target.value));
                  }}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                  <span>1 - Negligible</span>
                  <span>3 - Moderate</span>
                  <span>5 - Catastrophic</span>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Owner & Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="risk-owner" className="block text-xs font-medium text-slate-300 mb-1">
                Risk Owner *
              </label>
              <input
                id="risk-owner"
                type="text"
                required
                value={owner !== "" ? owner : activeAsset?.owner || ""}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="e.g. Lead Engineer"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label htmlFor="risk-duedate" className="block text-xs font-medium text-slate-300 mb-1">
                Target Due Date (Optional)
              </label>
              <input
                id="risk-duedate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="risk-notes" className="block text-xs font-medium text-slate-300 mb-1">
              Assessment Notes & Justification
            </label>
            <textarea
              id="risk-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observed risk context, potential attack vector, existing environment factors..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedAssetId || !selectedThreatKey || !selectedVulKey}
              className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900/50 rounded-lg transition shadow-lg shadow-indigo-600/30"
            >
              {submitting ? "Assessing..." : "Create Risk Assessment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
