"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ASSET_TYPES, AssetType } from "@/data/types";

interface CreateAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (createdAsset: { id: string; name: string; type: string }) => void;
}

export function CreateAssetModal({ isOpen, onClose, onSuccess }: CreateAssetModalProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState<AssetType>("Server");
  const [owner, setOwner] = useState("");
  const [confidentiality, setConfidentiality] = useState(3);
  const [integrity, setIntegrity] = useState(3);
  const [availability, setAvailability] = useState(3);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const criticality = Math.max(confidentiality, integrity, availability);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter an asset name.");
      return;
    }
    if (!owner.trim()) {
      setError("Please specify an asset owner.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type,
          owner: owner.trim(),
          confidentiality,
          integrity,
          availability,
          description: description.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to create asset.");
      }

      const created = await res.json();
      router.refresh();
      onClose();
      if (onSuccess) {
        onSuccess(created);
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const getCriticalityBadge = (crit: number) => {
    if (crit >= 5) return "bg-rose-950/80 text-rose-300 border-rose-700";
    if (crit === 4) return "bg-orange-950/80 text-orange-300 border-orange-700";
    if (crit === 3) return "bg-amber-950/80 text-amber-300 border-amber-700";
    return "bg-emerald-950/80 text-emerald-300 border-emerald-700";
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-asset-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 text-white max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h2 id="create-asset-title" className="text-lg font-semibold tracking-tight text-white">
              Create New Asset
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Define a hardware, software, or data asset to assess security risks against.
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
          <div>
            <label htmlFor="asset-name" className="block text-xs font-medium text-slate-300 mb-1">
              Asset Name *
            </label>
            <input
              id="asset-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Production Database Cluster"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="asset-type" className="block text-xs font-medium text-slate-300 mb-1">
                Asset Category *
              </label>
              <select
                id="asset-type"
                value={type}
                onChange={(e) => setType(e.target.value as AssetType)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {ASSET_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="asset-owner" className="block text-xs font-medium text-slate-300 mb-1">
                Owner / Department *
              </label>
              <input
                id="asset-owner"
                type="text"
                required
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="e.g. Infrastructure Team"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* CIA Ratings */}
          <div className="p-4 bg-slate-800/60 border border-slate-700/80 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-200">
                CIA Impact Ratings (1–5)
              </span>
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${getCriticalityBadge(
                  criticality
                )}`}
              >
                Criticality: Tier {criticality}
              </span>
            </div>

            <div className="space-y-3 pt-1">
              {/* Confidentiality */}
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>Confidentiality (C):</span>
                  <span className="font-semibold text-indigo-400">{confidentiality} / 5</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={confidentiality}
                  onChange={(e) => setConfidentiality(Number(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>

              {/* Integrity */}
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>Integrity (I):</span>
                  <span className="font-semibold text-indigo-400">{integrity} / 5</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={integrity}
                  onChange={(e) => setIntegrity(Number(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>

              {/* Availability */}
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>Availability (A):</span>
                  <span className="font-semibold text-indigo-400">{availability} / 5</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={availability}
                  onChange={(e) => setAvailability(Number(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="asset-desc" className="block text-xs font-medium text-slate-300 mb-1">
              Description (Optional)
            </label>
            <textarea
              id="asset-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="System details, data classification, network zone..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900/50 rounded-lg transition shadow-lg shadow-indigo-600/30"
            >
              {loading ? "Creating..." : "Save Asset"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
