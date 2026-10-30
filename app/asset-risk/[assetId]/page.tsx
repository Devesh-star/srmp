import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/api/route";
import { connectDB } from "@/lib/db";
import { assetRiskService } from "@/services/assetRiskService";
import { Asset } from "@/models/Asset";
import { roundTo } from "@/lib/riskEngine";
import { getLevelBadgeClasses, getStatusBadgeClasses } from "@/lib/ui/levelStyles";
import { AppError } from "@/lib/errors";
import { AssetRiskActions } from "@/components/assets/AssetRiskActions";

interface AssetRiskDetailPageProps {
  params: Promise<{
    assetId: string;
  }>;
  searchParams: Promise<{
    basis?: "residual" | "inherent";
    includeClosed?: string;
  }>;
}

export default async function AssetRiskDetailPage({
  params,
  searchParams,
}: AssetRiskDetailPageProps) {
  await connectDB();
  let ctx;
  try {
    ctx = await requireAuth(["admin", "assessor", "viewer"]);
  } catch {
    ctx = { organizationId: "org_default", actor: "demo_admin", role: "admin" };
  }

  const { assetId } = await params;
  const sp = await searchParams;
  const basis = sp.basis === "inherent" ? "inherent" : "residual";
  const includeClosed = sp.includeClosed === "true";

  let assetDetail;
  let rawAsset;
  try {
    [assetDetail, rawAsset] = await Promise.all([
      assetRiskService.getAssetRisk(
        { organizationId: ctx.organizationId, actorId: ctx.actor },
        assetId,
        { basis, includeClosed }
      ),
      Asset.findOne({ _id: assetId, organizationId: ctx.organizationId }).lean(),
    ]);
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 404) {
      notFound();
    }
    notFound();
  }

  if (!rawAsset) {
    notFound();
  }

  const toggleClosedUrl = (current: boolean) => {
    const p = new URLSearchParams();
    if (basis !== "residual") p.set("basis", basis);
    if (!current) p.set("includeClosed", "true");
    const qs = p.toString();
    return qs ? `/asset-risk/${assetId}?${qs}` : `/asset-risk/${assetId}`;
  };

  const toggleBasisUrl = (newBasis: "residual" | "inherent") => {
    const p = new URLSearchParams();
    if (newBasis !== "residual") p.set("basis", newBasis);
    if (includeClosed) p.set("includeClosed", "true");
    const qs = p.toString();
    return qs ? `/asset-risk/${assetId}?${qs}` : `/asset-risk/${assetId}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <Link href="/asset-risk" className="hover:text-white transition-colors">
            ← Back to Asset Risk List
          </Link>
          <span>/</span>
          <span className="text-white font-medium">{assetDetail.name}</span>
        </div>

        <Link
          href={`/assets/${assetId}`}
          className="text-indigo-400 hover:text-indigo-300 font-semibold"
        >
          View Asset Profile →
        </Link>
      </div>

      {/* Asset Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-white tracking-tight">{assetDetail.name}</h1>
              <span className="capitalize px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300">
                {assetDetail.type}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Owner: <span className="text-slate-200">{assetDetail.owner || "Unassigned"}</span>
            </p>
          </div>

          {/* Asset Overall Risk Badge */}
          <div className="flex flex-col sm:items-end">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Overall Asset Risk ({basis})
            </span>
            <div className="flex items-center gap-2">
              <span
                className={`px-3 py-1 rounded-full border text-xs font-extrabold shadow ${getLevelBadgeClasses(
                  assetDetail.level
                )}`}
              >
                {assetDetail.level ? `Overall asset risk: ${assetDetail.level}` : "Not assessed"}
              </span>
              {assetDetail.level && (
                <span className="font-mono font-black text-white text-lg">
                  {roundTo(assetDetail.maxScore, 1)}
                </span>
              )}
            </div>
            <span className="text-[11px] text-slate-500 italic mt-1">
              Level = the worst risk on this asset
            </span>
          </div>
        </div>

        {/* Criticality & CIA Scores */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Criticality Score
            </span>
            <span className="font-mono font-black text-white text-xl">
              {roundTo(assetDetail.criticality, 1)}
            </span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Confidentiality (C)
            </span>
            <span className="font-mono font-bold text-slate-200 text-lg">
              {rawAsset.confidentiality} / 5
            </span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Integrity (I)
            </span>
            <span className="font-mono font-bold text-slate-200 text-lg">
              {rawAsset.integrity} / 5
            </span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Availability (A)
            </span>
            <span className="font-mono font-bold text-slate-200 text-lg">
              {rawAsset.availability} / 5
            </span>
          </div>
        </div>
      </div>

      {/* Risk Table Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden">
        {/* Table Controls */}
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/40">
          <div>
            <h2 className="text-sm font-bold text-white">Associated Risks ({assetDetail.risks.length})</h2>
            <p className="text-xs text-slate-400">
              Evaluated on {basis} basis • Ranked by highest score
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <AssetRiskActions assetId={assetId} />

            {/* Basis Toggle */}
            <div className="inline-flex rounded-lg bg-slate-900 border border-slate-800 p-0.5" role="group">
              <Link
                href={toggleBasisUrl("residual")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                  basis === "residual"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Residual
              </Link>
              <Link
                href={toggleBasisUrl("inherent")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                  basis === "inherent"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Inherent
              </Link>
            </div>

            {/* Include Closed Toggle */}
            <Link
              href={toggleClosedUrl(includeClosed)}
              className={`px-3 py-1 text-xs font-medium rounded-lg border transition-colors ${
                includeClosed
                  ? "bg-slate-800 text-white border-slate-600"
                  : "bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200"
              }`}
            >
              {includeClosed ? "✓ Showing Closed" : "Show Closed"}
            </Link>

            {/* Assess Risk Link */}
            {(ctx.role === "admin" || ctx.role === "assessor") && (
              <Link
                href={`/risks/new?assetId=${assetId}`}
                className="px-3 py-1 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow transition-colors whitespace-nowrap"
              >
                + Add Risk
              </Link>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <caption className="sr-only">Risks associated with {assetDetail.name}</caption>
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                <th scope="col" className="py-3 px-4">Risk ID</th>
                <th scope="col" className="py-3 px-4">Threat</th>
                <th scope="col" className="py-3 px-4">Vulnerability</th>
                <th scope="col" className="py-3 px-2 text-center">L</th>
                <th scope="col" className="py-3 px-2 text-center">I</th>
                <th scope="col" className="py-3 px-3 font-mono">Inherent</th>
                <th scope="col" className="py-3 px-3 font-mono">Residual</th>
                <th scope="col" className="py-3 px-3">Level ({basis})</th>
                <th scope="col" className="py-3 px-3">Status</th>
                <th scope="col" className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {assetDetail.risks.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    No risks currently mapped to this asset.
                  </td>
                </tr>
              ) : (
                assetDetail.risks.map((risk) => (
                  <tr key={risk.riskId} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-400">
                      <Link href={`/risks/${risk.riskId}`} className="hover:underline">
                        {risk.riskId}
                      </Link>
                    </td>
                    <td className="py-3 px-4 font-medium text-white">{risk.threatName}</td>
                    <td className="py-3 px-4 text-slate-400">{risk.vulnerabilityName}</td>
                    <td className="py-3 px-2 text-center font-mono text-slate-300">
                      {risk.likelihood}
                    </td>
                    <td className="py-3 px-2 text-center font-mono text-slate-300">
                      {risk.impact}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-amber-400">
                      {roundTo(risk.inherentScore, 1)}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-emerald-400">
                      {roundTo(risk.residualScore, 1)}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[11px] border font-bold ${getLevelBadgeClasses(risk.level)}`}>
                        {risk.level}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[11px] border font-medium ${getStatusBadgeClasses(risk.status)}`}>
                        {risk.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        href={`/simulator?riskId=${risk.riskId}`}
                        className="text-xs font-semibold text-indigo-400 hover:text-indigo-300"
                        title="Simulate control additions for this risk"
                      >
                        Simulate ⚡
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
