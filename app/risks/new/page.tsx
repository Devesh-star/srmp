"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { CreateRiskModal } from "@/components/risks/CreateRiskModal";

function NewRiskContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const assetId = searchParams.get("assetId") || undefined;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/risks"
            className="text-xs text-indigo-400 hover:text-indigo-300 transition flex items-center gap-1"
          >
            ← Back to Risk Register
          </Link>
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Perform Risk Assessment
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Evaluate assets against threat scenarios, map vulnerabilities, and calculate inherent risk scores.
          </p>
        </div>

        <CreateRiskModal
          isOpen={true}
          onClose={() => router.push("/risks")}
          preselectedAssetId={assetId}
          onSuccess={(created) => router.push(`/risks/${created.riskId}`)}
        />
      </div>
    </div>
  );
}

export default function NewRiskPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 text-white p-8">Loading...</div>}>
      <NewRiskContent />
    </Suspense>
  );
}
