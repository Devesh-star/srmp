import mongoose from "mongoose";
import { Asset } from "@/models/Asset";
import { Risk } from "@/models/Risk";
import { Threat } from "@/models/Threat";
import { Vulnerability } from "@/models/Vulnerability";
import { AssetType } from "@/data/types";
import { RiskLevel, criticality, level } from "@/lib/riskEngine";
import { AppError } from "@/lib/errors";

export interface Ctx {
  organizationId: string;
  actorId: string;
}

export interface AssetRiskRow {
  assetId: string;
  name: string;
  type: AssetType;
  owner: string;
  criticality: number;
  riskCount: number;
  levelCounts: Record<RiskLevel, number>;
  maxScore: number;
  level: RiskLevel | null;
  totalScore: number;
  topRisk: {
    riskId: string;
    threatName: string;
    score: number;
  } | null;
}

export interface AssetRiskListQuery {
  basis: "inherent" | "residual";
  q?: string;
  type?: AssetType;
  sort: "maxScore" | "totalScore" | "criticality" | "name";
  order: "asc" | "desc";
  includeUnassessed: boolean;
  page: number;
  limit: number;
}

export interface AssetRiskListResult {
  items: AssetRiskRow[];
  total: number;
  page: number;
  limit: number;
  summary: {
    assets: number;
    assessed: number;
    unassessed: number;
  };
}

export interface AssetRiskDetailRisk {
  riskId: string;
  threatName: string;
  vulnerabilityName: string;
  likelihood: number;
  impact: number;
  inherentScore: number;
  residualScore: number;
  level: RiskLevel;
  status: string;
}

export interface AssetRiskDetailResult extends AssetRiskRow {
  risks: AssetRiskDetailRisk[];
}

/**
 * Shared pure row-building function between assetRiskService and dashboardService.
 * Guarantees identical calculation across both services.
 */
export function buildAssetRiskRow(
  asset: {
    _id: mongoose.Types.ObjectId | string;
    name: string;
    type: AssetType;
    owner: string;
    confidentiality: number;
    integrity: number;
    availability: number;
  },
  assetRisks: Array<{
    riskId: string;
    threatId: string;
    inherentScore: number;
    residualScore: number;
  }>,
  threatNameMap: Map<string, string>,
  basis: "inherent" | "residual"
): AssetRiskRow {
  const crit = criticality(asset.confidentiality, asset.integrity, asset.availability);
  const riskCount = assetRisks.length;

  if (riskCount === 0) {
    return {
      assetId: asset._id.toString(),
      name: asset.name,
      type: asset.type,
      owner: asset.owner,
      criticality: crit,
      riskCount: 0,
      levelCounts: { Low: 0, Medium: 0, High: 0, Critical: 0 },
      maxScore: 0,
      level: null,
      totalScore: 0,
      topRisk: null,
    };
  }

  const levelCounts: Record<RiskLevel, number> = { Low: 0, Medium: 0, High: 0, Critical: 0 };
  let maxScore = -1;
  let totalScore = 0;
  let topRiskCandidate: { riskId: string; threatName: string; score: number } | null = null;

  for (const r of assetRisks) {
    const s = basis === "inherent" ? r.inherentScore : r.residualScore;
    totalScore += s;
    const lvl = level(s);
    levelCounts[lvl]++;

    if (
      s > maxScore ||
      (s === maxScore &&
        topRiskCandidate &&
        r.riskId.localeCompare(topRiskCandidate.riskId) < 0) ||
      maxScore === -1
    ) {
      maxScore = s;
      topRiskCandidate = {
        riskId: r.riskId,
        threatName: threatNameMap.get(r.threatId) || r.threatId,
        score: s,
      };
    }
  }

  return {
    assetId: asset._id.toString(),
    name: asset.name,
    type: asset.type,
    owner: asset.owner,
    criticality: crit,
    riskCount,
    levelCounts,
    maxScore: maxScore === -1 ? 0 : maxScore,
    level: maxScore === -1 ? null : level(maxScore),
    totalScore,
    topRisk: topRiskCandidate,
  };
}

export const assetRiskService = {
  /**
   * Lists asset risk rows with filtering, searching, sorting, and pagination.
   */
  async listAssetRisk(ctx: Ctx, query: AssetRiskListQuery): Promise<AssetRiskListResult> {
    const assetFilter: Record<string, unknown> = {
      organizationId: ctx.organizationId,
    };

    if (query.q && query.q.length > 0) {
      const escaped = query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(escaped, "i");
      assetFilter.$or = [{ name: re }, { owner: re }];
    }

    if (query.type) {
      assetFilter.type = query.type;
    }

    const [assets, risks, threats] = await Promise.all([
      Asset.find(assetFilter)
        .select("_id name type owner confidentiality integrity availability")
        .lean(),
      Risk.find({
        organizationId: ctx.organizationId,
        status: { $ne: "Closed" },
      })
        .select("riskId assetId threatId inherentScore residualScore")
        .lean(),
      Threat.find({
        organizationId: { $in: [null, ctx.organizationId] },
      })
        .select("key name")
        .lean(),
    ]);

    const threatMap = new Map<string, string>();
    for (const t of threats) {
      threatMap.set(t.key, t.name);
    }

    // Group included risks by assetId
    const risksByAssetId = new Map<string, typeof risks>();
    for (const r of risks) {
      const aId = r.assetId.toString();
      const existing = risksByAssetId.get(aId) || [];
      existing.push(r);
      risksByAssetId.set(aId, existing);
    }

    // Build rows for all matching assets
    const allRows: AssetRiskRow[] = assets.map((a) => {
      const assetRisks = risksByAssetId.get(a._id.toString()) || [];
      return buildAssetRiskRow(a, assetRisks, threatMap, query.basis);
    });

    // Summary counts over the assets matching search/type
    const assessedCount = allRows.filter((r) => r.riskCount > 0).length;
    const unassessedCount = allRows.filter((r) => r.riskCount === 0).length;
    const summary = {
      assets: allRows.length,
      assessed: assessedCount,
      unassessed: unassessedCount,
    };

    // Filter unassessed if requested
    let filteredRows = allRows;
    if (!query.includeUnassessed) {
      filteredRows = allRows.filter((r) => r.riskCount > 0);
    }

    // Sort rows
    const { sort, order } = query;
    filteredRows.sort((a, b) => {
      if (sort === "maxScore") {
        // "Sorting by maxScore with 'Not assessed' assets always last"
        const aAssessed = a.riskCount > 0;
        const bAssessed = b.riskCount > 0;
        if (aAssessed && !bAssessed) return -1;
        if (!aAssessed && bAssessed) return 1;
        if (!aAssessed && !bAssessed) return a.name.localeCompare(b.name);

        const diff = order === "desc" ? b.maxScore - a.maxScore : a.maxScore - b.maxScore;
        if (diff !== 0) return diff;
        return a.name.localeCompare(b.name);
      }

      if (sort === "totalScore") {
        const diff = order === "desc" ? b.totalScore - a.totalScore : a.totalScore - b.totalScore;
        if (diff !== 0) return diff;
        return a.name.localeCompare(b.name);
      }

      if (sort === "criticality") {
        const diff = order === "desc" ? b.criticality - a.criticality : a.criticality - b.criticality;
        if (diff !== 0) return diff;
        return a.name.localeCompare(b.name);
      }

      // sort === "name"
      const diff = order === "desc" ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name);
      return diff;
    });

    const total = filteredRows.length;
    const startIndex = (query.page - 1) * query.limit;
    const items = filteredRows.slice(startIndex, startIndex + query.limit);

    return {
      items,
      total,
      page: query.page,
      limit: query.limit,
      summary,
    };
  },

  /**
   * Retrieves asset risk detail with individual risks.
   */
  async getAssetRisk(
    ctx: Ctx,
    assetId: string,
    options: { basis: "inherent" | "residual"; includeClosed: boolean }
  ): Promise<AssetRiskDetailResult> {
    if (!mongoose.Types.ObjectId.isValid(assetId)) {
      throw new AppError(404, "Asset not found");
    }

    const asset = await Asset.findOne({
      _id: new mongoose.Types.ObjectId(assetId),
      organizationId: ctx.organizationId,
    })
      .select("_id name type owner confidentiality integrity availability")
      .lean();

    if (!asset) {
      throw new AppError(404, "Asset not found");
    }

    const riskQuery: Record<string, unknown> = {
      organizationId: ctx.organizationId,
      assetId: asset._id,
    };
    if (!options.includeClosed) {
      riskQuery.status = { $ne: "Closed" };
    }

    const [risks, threats, vulnerabilities] = await Promise.all([
      Risk.find(riskQuery)
        .select(
          "riskId threatId vulnerabilityId likelihood impact inherentScore residualScore status"
        )
        .lean(),
      Threat.find({
        organizationId: { $in: [null, ctx.organizationId] },
      })
        .select("key name")
        .lean(),
      Vulnerability.find({
        organizationId: { $in: [null, ctx.organizationId] },
      })
        .select("key name")
        .lean(),
    ]);

    const threatMap = new Map<string, string>();
    for (const t of threats) {
      threatMap.set(t.key, t.name);
    }

    const vulnMap = new Map<string, string>();
    for (const v of vulnerabilities) {
      vulnMap.set(v.key, v.name);
    }

    // For row calculation, only included (non-closed) risks define the asset's active risk level
    const includedRisks = risks.filter((r) => r.status !== "Closed");
    const row = buildAssetRiskRow(asset, includedRisks, threatMap, options.basis);

    const detailedRisks: AssetRiskDetailRisk[] = risks.map((r) => {
      const s = options.basis === "inherent" ? r.inherentScore : r.residualScore;
      return {
        riskId: r.riskId,
        threatName: threatMap.get(r.threatId) || r.threatId,
        vulnerabilityName: vulnMap.get(r.vulnerabilityId) || r.vulnerabilityId,
        likelihood: r.likelihood,
        impact: r.impact,
        inherentScore: r.inherentScore,
        residualScore: r.residualScore,
        level: level(s),
        status: r.status,
      };
    });

    detailedRisks.sort((a, b) => {
      const aScore = options.basis === "inherent" ? a.inherentScore : a.residualScore;
      const bScore = options.basis === "inherent" ? b.inherentScore : b.residualScore;
      const diff = bScore - aScore;
      if (diff !== 0) return diff;
      return a.riskId.localeCompare(b.riskId);
    });

    return {
      ...row,
      risks: detailedRisks,
    };
  },
};
