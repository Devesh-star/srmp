"use client";

import React, { useState } from "react";
import { CreateAssetModal } from "@/components/assets/CreateAssetModal";
import { CreateRiskModal } from "@/components/risks/CreateRiskModal";

interface AssetRiskActionsProps {
  assetId?: string;
}

export function AssetRiskActions({ assetId }: AssetRiskActionsProps) {
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [showRiskModal, setShowRiskModal] = useState(false);

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowAssetModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 transition shadow-sm"
        >
          <span className="text-sm font-bold text-indigo-400">+</span>
          <span>Add Asset</span>
        </button>

        <button
          type="button"
          onClick={() => setShowRiskModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition"
        >
          <span className="text-sm font-bold">+</span>
          <span>Assess Risk</span>
        </button>
      </div>

      <CreateAssetModal
        isOpen={showAssetModal}
        onClose={() => setShowAssetModal(false)}
        onSuccess={() => {
          // Asset created; prompt to assess risk on it
          setShowAssetModal(false);
          setShowRiskModal(true);
        }}
      />

      <CreateRiskModal
        isOpen={showRiskModal}
        onClose={() => setShowRiskModal(false)}
        preselectedAssetId={assetId}
      />
    </>
  );
}
