import React from "react";
import Link from "next/link";
import { requireAuth } from "@/lib/api/route";
import { connectDB } from "@/lib/db";
import { assetRiskService } from "@/services/assetRiskService";
import { ASSET_TYPES, AssetType } from "@/data/types";
import { roundTo } from "@/lib/riskEngine";
import { getLevelBadgeClasses } from "@/lib/ui/levelStyles";
import { AssetRiskActions } from "@/components/assets/AssetRiskActions";

interface AssetRiskPageProps {
  searchParams: Promise<{
    basis?: "residual" | "inherent";
    q?: string;
    type?: string;
    sort?: "maxScore" | "totalScore" | "criticality" | "name";
    order?: "asc" | "desc";
    includeUnassessed?: string;
    page?: string;
    limit?: string;
  }>;
}

export default async function AssetRiskListPage({ searchParams }: AssetRiskPageProps) {
  await connectDB();
  let ctx;
  try {
    ctx = await requireAuth(["admin", "assessor", "viewer"]);
  } catch {
    ctx = { organizationId: "org_default", actor: "demo_admin", role: "admin" };
  }

  const sp = await searchParams;
  const basis = sp.basis === "inherent" ? "inherent" : "residual";
  const q = sp.q?.trim() || undefined;
  const type = ASSET_TYPES.includes(sp.type as AssetType) ? (sp.type as AssetType) : undefined;
  const sort = sp.sort || "maxScore";
  const order = sp.order || "desc";
  const includeUnassessed = sp.includeUnassessed !== "false";
  const page = Math.max(1, parseInt(sp.page || "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(sp.limit || "20", 10) || 20));

  const result = await assetRiskService.listAssetRisk(
    { organizationId: ctx.organizationId, actorId: ctx.actor },
    {
      basis,
      q,
      type,
      sort,
      order,
      includeUnassessed,
      page,
      limit,
    }
  );

  const canAssess = ctx.role === "admin" || ctx.role === "assessor";
  const totalPages = Math.ceil(result.total / limit) || 1;

  // Helper to build URL with query params
  const buildUrl = (overrides: Record<string, string | number | undefined | null>) => {
    const params = new URLSearchParams();
    if (basis !== "residual") params.set("basis", basis);
    if (q) params.set("q", q);
    if (type) params.set("type", type);
    if (sort !== "maxScore") params.set("sort", sort);
    if (order !== "desc") params.set("order", order);
    if (!includeUnassessed) params.set("includeUnassessed", "false");
    if (page > 1) params.set("page", String(page));

    for (const [key, val] of Object.entries(overrides)) {
      if (val === null || val === undefined || val === "") {
        params.delete(key);
      } else {
        params.set(key, String(val));
      }
    }
    const qs = params.toString();
    return qs ? `/asset-risk?${qs}` : "/asset-risk";
  };

  const getSortUrl = (column: "maxScore" | "totalScore" | "criticality" | "name") => {
    const nextOrder = sort === column && order === "desc" ? "asc" : "desc";
    return buildUrl({ sort: column, order: nextOrder, page: 1 });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Asset Risk Posture</h1>
          <p className="text-xs text-slate-400 mt-1">
            Aggregated exposure per organizational asset using the &quot;worst risk&quot; rule (level = max risk score)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <AssetRiskActions />

          {/* Basis Toggle */}
          <div className="inline-flex rounded-lg bg-slate-900 border border-slate-800 p-0.5" role="group">
            <Link
              href={buildUrl({ basis: "residual", page: 1 })}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                basis === "residual"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Residual Basis
            </Link>
            <Link
              href={buildUrl({ basis: "inherent", page: 1 })}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                basis === "inherent"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Inherent Basis
            </Link>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg space-y-3">
        <form method="GET" action="/asset-risk" className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          <input type="hidden" name="basis" value={basis} />
          <input type="hidden" name="sort" value={sort} />
          <input type="hidden" name="order" value={order} />

          {/* Search Box */}
          <div className="sm:col-span-5">
            <input
              type="text"
              name="q"
              defaultValue={q || ""}
              placeholder="Search by asset name or owner..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Type Filter */}
          <div className="sm:col-span-3">
            <select
              name="type"
              defaultValue={type || ""}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 capitalize"
            >
              <option value="">All Asset Types</option>
              {ASSET_TYPES.map((t) => (
                <option key={t} value={t} className="capitalize">
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Include Unassessed Checkbox */}
          <div className="sm:col-span-3 flex items-center gap-2">
            <label className="text-xs text-slate-300 flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                name="includeUnassessed"
                value="true"
                defaultChecked={includeUnassessed}
                className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Include unassessed assets</span>
            </label>
          </div>

          {/* Submit */}
          <div className="sm:col-span-1">
            <button
              type="submit"
              className="w-full px-3 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow transition-colors"
            >
              Filter
            </button>
          </div>
        </form>

        {/* Result Summary */}
        <div className="flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-2.5">
          <span>
            <strong className="text-white font-mono">{result.summary.assets}</strong> total assets:{" "}
            <strong className="text-emerald-400 font-mono">{result.summary.assessed}</strong> assessed,{" "}
            <strong className="text-slate-400 font-mono">{result.summary.unassessed}</strong> not assessed
          </span>
          <span>
            Showing {result.items.length} of {result.total} matching assets
          </span>
        </div>
      </div>

      {/* Asset Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <caption className="sr-only">Organizational Assets and their aggregated risk exposures</caption>
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                <th scope="col" className="py-3 px-4">
                  <Link href={getSortUrl("name")} className="hover:text-white inline-flex items-center gap-1">
                    Asset Name {sort === "name" && (order === "desc" ? "▼" : "▲")}
                  </Link>
                </th>
                <th scope="col" className="py-3 px-3">Type</th>
                <th scope="col" className="py-3 px-3">Owner</th>
                <th scope="col" className="py-3 px-3">
                  <Link href={getSortUrl("criticality")} className="hover:text-white inline-flex items-center gap-1">
                    Criticality {sort === "criticality" && (order === "desc" ? "▼" : "▲")}
                  </Link>
                </th>
                <th scope="col" className="py-3 px-3">Risks</th>
                <th scope="col" className="py-3 px-4">
                  <Link href={getSortUrl("maxScore")} className="hover:text-white inline-flex items-center gap-1">
                    Worst Risk Score & Level {sort === "maxScore" && (order === "desc" ? "▼" : "▲")}
                  </Link>
                </th>
                <th scope="col" className="py-3 px-3">
                  <Link href={getSortUrl("totalScore")} className="hover:text-white inline-flex items-center gap-1">
                    Total Score {sort === "totalScore" && (order === "desc" ? "▼" : "▲")}
                  </Link>
                </th>
                <th scope="col" className="py-3 px-4">Level Breakdown</th>
                <th scope="col" className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {result.items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    No matching assets found
                  </td>
                </tr>
              ) : (
                result.items.map((row) => (
                  <tr key={row.assetId} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4">
                      <Link
                        href={`/asset-risk/${row.assetId}?basis=${basis}`}
                        className="font-bold text-white hover:text-indigo-400 text-sm block"
                      >
                        {row.name}
                      </Link>
                      {row.topRisk && (
                        <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-xs">
                          Top: <span className="text-indigo-300 font-mono">{row.topRisk.riskId}</span> • {row.topRisk.threatName}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <span className="capitalize px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px]">
                        {row.type}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-400">{row.owner || "—"}</td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-200">
                      {roundTo(row.criticality, 1)}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-white">
                      {row.riskCount}
                    </td>
                    <td className="py-3 px-4">
                      {row.level ? (
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[11px] border font-bold ${getLevelBadgeClasses(row.level)}`}>
                            {row.level}
                          </span>
                          <span className="font-mono font-black text-white text-sm">
                            {roundTo(row.maxScore, 1)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500 italic">Not assessed</span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-300">
                      {row.level ? roundTo(row.totalScore, 1) : "—"}
                    </td>
                    <td className="py-3 px-4">
                      {row.riskCount > 0 ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {row.levelCounts.Critical > 0 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-950/80 text-rose-400 border border-rose-800">
                              {row.levelCounts.Critical} Crit
                            </span>
                          )}
                          {row.levelCounts.High > 0 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-orange-950/80 text-orange-400 border border-orange-800">
                              {row.levelCounts.High} High
                            </span>
                          )}
                          {row.levelCounts.Medium > 0 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-950/80 text-amber-400 border border-amber-800">
                              {row.levelCounts.Medium} Med
                            </span>
                          )}
                          {row.levelCounts.Low > 0 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800">
                              {row.levelCounts.Low} Low
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-600 text-[11px]">No risks</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {row.riskCount === 0 && canAssess ? (
                        <Link
                          href={`/risks/new?assetId=${row.assetId}`}
                          className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 underline"
                        >
                          Assess risk
                        </Link>
                      ) : (
                        <Link
                          href={`/asset-risk/${row.assetId}?basis=${basis}`}
                          className="text-xs font-semibold text-slate-400 hover:text-white"
                        >
                          View detail →
                        </Link>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <div>
              Page <span className="font-bold text-white">{page}</span> of {totalPages}
            </div>
            <div className="flex items-center gap-2">
              {page > 1 ? (
                <Link
                  href={buildUrl({ page: page - 1 })}
                  className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors"
                >
                  Previous
                </Link>
              ) : (
                <span className="px-3 py-1 rounded bg-slate-900 text-slate-600 font-medium">
                  Previous
                </span>
              )}

              {page < totalPages ? (
                <Link
                  href={buildUrl({ page: page + 1 })}
                  className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors"
                >
                  Next
                </Link>
              ) : (
                <span className="px-3 py-1 rounded bg-slate-900 text-slate-600 font-medium">
                  Next
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
