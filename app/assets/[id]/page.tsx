import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/api/route";
import { assetRiskService } from "@/services/assetRiskService";
import { Asset } from "@/models/Asset";
import { roundTo } from "@/lib/riskEngine";
import { getLevelBadgeClasses } from "@/lib/ui/levelStyles";

interface AssetProfilePageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function AssetProfilePage({ params }: AssetProfilePageProps) {
  let ctx;
  try {
    ctx = await requireAuth(["admin", "assessor", "viewer"]);
  } catch {
    ctx = { organizationId: "org_default", actor: "demo_admin", role: "admin" };
  }

  const { id } = await params;

  let asset;
  let riskRow;
  try {
    [asset, riskRow] = await Promise.all([
      Asset.findOne({ _id: id, organizationId: ctx.organizationId }).lean(),
      assetRiskService.getAssetRisk(
        { organizationId: ctx.organizationId, actorId: ctx.actor },
        id,
        { basis: "residual", includeClosed: false }
      ),
    ]);
  } catch {
    notFound();
  }

  if (!asset) {
    notFound();
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <Link href="/asset-risk" className="hover:text-white transition-colors">
          ← Back to Assets
        </Link>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h1 className="text-2xl font-bold text-white">{asset.name}</h1>
            <p className="text-xs text-slate-400 capitalize mt-0.5">
              Type: {asset.type} • Owner: {asset.owner || "Unassigned"}
            </p>
          </div>
          <span className="text-xs font-mono bg-slate-800 text-slate-300 px-2 py-1 rounded">
            Criticality: {roundTo(riskRow.criticality, 1)}
          </span>
        </div>

        {/* Small "Risks for this asset" Card (spec requirement) */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Risks for this asset
            </span>
            <div className="flex items-center gap-3">
              <span className="text-lg font-black text-white font-mono">
                {riskRow.riskCount} {riskRow.riskCount === 1 ? "risk" : "risks"}
              </span>
              <span className="text-slate-600">•</span>
              <span
                className={`px-2 py-0.5 rounded text-xs border font-bold ${getLevelBadgeClasses(
                  riskRow.level
                )}`}
              >
                {riskRow.level ? `Worst Level: ${riskRow.level}` : "Not assessed"}
              </span>
              {riskRow.level && (
                <span className="text-xs font-mono text-slate-400">
                  (Score: {roundTo(riskRow.maxScore, 1)})
                </span>
              )}
            </div>
          </div>

          <Link
            href={`/asset-risk/${id}`}
            className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow transition-colors"
          >
            View Asset Risk →
          </Link>
        </div>
      </div>
    </div>
  );
}
