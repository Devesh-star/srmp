import { Risk } from "@/models/Risk";
import { Asset } from "@/models/Asset";
import { Threat } from "@/models/Threat";
import { Vulnerability } from "@/models/Vulnerability";
import { Control } from "@/models/Control";
import { Assessment, IAssessment } from "@/models/Assessment";
import {
  RiskLevel,
  summarize,
  overallLevel,
  level,
  levelRange,
  computeResidual,
  roundTo,
} from "@/lib/riskEngine";
import { assessmentService, AssessmentTrendItemDTO } from "@/services/assessmentService";
import { buildAssetRiskRow, AssetRiskRow } from "@/services/assetRiskService";
import { AppError } from "@/lib/errors";

export interface Ctx {
  organizationId: string;
  actorId: string;
}

export interface DashboardDTO {
  basis: "inherent" | "residual";
  generatedAt: string;
  totals: {
    assets: number;
    includedRisks: number;
    closedRisks: number;
  };
  overall: {
    score: number;
    level: RiskLevel;
    max: number;
    maxLevel: RiskLevel;
    counts: Record<RiskLevel, number>;
  };
  inherentOverall: {
    score: number;
    level: RiskLevel;
  };
  residualOverall: {
    score: number;
    level: RiskLevel;
  };
  projected: {
    score: number;
    level: RiskLevel;
    delta: number;
    risksAffected: number;
  };
  snapshotComparison: {
    label: string;
    date: string;
    score: number;
    delta: number;
  } | null;
  distribution: Array<{
    level: RiskLevel;
    count: number;
  }>;
  byCategory: Array<{
    category: string;
    Low: number;
    Medium: number;
    High: number;
    Critical: number;
    total: number;
  }>;
  topRisks: Array<{
    riskId: string;
    assetName: string;
    threatName: string;
    vulnerabilityName: string;
    score: number;
    level: RiskLevel;
    inherentScore: number;
    residualScore: number;
    status: string;
  }>;
  vulnerableAssets: AssetRiskRow[];
  inherentVsResidual: Array<{
    riskId: string;
    label: string;
    inherent: number;
    residual: number;
  }>;
  controlImplementation: {
    planned: number;
    implemented: number;
    total: number;
    percentImplemented: number;
    byCategory: Array<{
      category: string;
      planned: number;
      implemented: number;
    }>;
  };
  bands: {
    risk: Array<{
      level: RiskLevel;
      gte: number;
      lt: number | null;
    }>;
    overall: Array<{
      level: RiskLevel;
      from: number;
      to: number | null;
    }>;
  };
  trend: AssessmentTrendItemDTO[];
  live: {
    overallScore: number;
    inherentOverall: number;
    maxScore: number;
    counts: Record<RiskLevel, number>;
    date: string;
  };
}

/**
 * Computes dynamic overall bands [from, to) by scanning overallLevel() over 0..100.
 */
function computeOverallBands(): Array<{ level: RiskLevel; from: number; to: number | null }> {
  const bands: Array<{ level: RiskLevel; from: number; to: number | null }> = [];
  let currentLevel = overallLevel(0);
  let from = 0;

  for (let i = 1; i <= 100; i++) {
    const lvl = overallLevel(i);
    if (lvl !== currentLevel) {
      bands.push({ level: currentLevel, from, to: i });
      currentLevel = lvl;
      from = i;
    }
  }

  bands.push({ level: currentLevel, from, to: null });
  return bands;
}

export const dashboardService = {
  async getDashboard(
    ctx: Ctx,
    options: { basis: "inherent" | "residual"; trendLimit: number }
  ): Promise<DashboardDTO> {
    const generatedAt = new Date().toISOString();

    // 1. Guard against unbounded risk datasets
    const includedRiskCount = await Risk.countDocuments({
      organizationId: ctx.organizationId,
      status: { $ne: "Closed" },
    });

    if (includedRiskCount > 5000) {
      throw new AppError(409, "Too many risks to build the dashboard");
    }

    // 2. Parallel fetch for all required collections with projection
    const [
      includedRisks,
      closedRiskCount,
      assets,
      threats,
      vulnerabilities,
      controls,
      latestSnapshot,
      trend,
    ] = await Promise.all([
      Risk.find({
        organizationId: ctx.organizationId,
        status: { $ne: "Closed" },
      })
        .select(
          "riskId assetId threatId vulnerabilityId likelihood impact inherentScore residualScore treatment transferFactor controls status"
        )
        .lean(),
      Risk.countDocuments({
        organizationId: ctx.organizationId,
        status: "Closed",
      }),
      Asset.find({ organizationId: ctx.organizationId })
        .select("_id name type owner confidentiality integrity availability")
        .lean(),
      Threat.find({
        organizationId: { $in: [null, ctx.organizationId] },
      })
        .select("key name category")
        .lean(),
      Vulnerability.find({
        organizationId: { $in: [null, ctx.organizationId] },
      })
        .select("key name")
        .lean(),
      Control.find({
        organizationId: { $in: [null, ctx.organizationId] },
      })
        .select("key category effectiveness reduces")
        .lean(),
      Assessment.findOne({ organizationId: ctx.organizationId })
        .sort({ date: -1 })
        .lean(),
      assessmentService.getTrend(ctx, { limit: options.trendLimit }),
    ]);

    // Lookup Maps
    const assetMap = new Map<string, (typeof assets)[number]>();
    for (const a of assets) {
      assetMap.set(a._id.toString(), a);
    }

    const threatMap = new Map<string, (typeof threats)[number]>();
    const threatNameMap = new Map<string, string>();
    for (const t of threats) {
      threatMap.set(t.key, t);
      threatNameMap.set(t.key, t.name);
    }

    const vulnNameMap = new Map<string, string>();
    for (const v of vulnerabilities) {
      vulnNameMap.set(v.key, v.name);
    }

    const controlMap = new Map<string, (typeof controls)[number]>();
    for (const c of controls) {
      controlMap.set(c.key, c);
    }

    // 3. Overall scores
    const inherentScores = includedRisks.map((r) => r.inherentScore);
    const residualScores = includedRisks.map((r) => r.residualScore);
    const basisScores = options.basis === "inherent" ? inherentScores : residualScores;

    const inherentSummary = summarize(inherentScores);
    const residualSummary = summarize(residualScores);
    const basisSummary = summarize(basisScores);

    const inherentOverall = {
      score: inherentSummary.overall,
      level: overallLevel(inherentSummary.overall),
    };

    const residualOverall = {
      score: residualSummary.overall,
      level: overallLevel(residualSummary.overall),
    };

    const overall = {
      score: basisSummary.overall,
      level: overallLevel(basisSummary.overall),
      max: basisSummary.max,
      maxLevel: level(basisSummary.max),
      counts: basisSummary.counts,
    };

    // 4. Projected score ("if every planned control were implemented")
    let risksAffected = 0;
    const projectedScores: number[] = [];

    for (const r of includedRisks) {
      if (r.treatment === "mitigate") {
        const controlsList = r.controls as Array<{ controlId: string; status: string }>;
        const hasPlanned = controlsList.some((c) => c.status === "planned");
        if (hasPlanned) {
          risksAffected++;
        }

        // Treat all controls as implemented
        const resolvedControls = controlsList
          .map((c) => {
            const ctrlDoc = controlMap.get(c.controlId);
            if (!ctrlDoc) return null;
            return {
              id: c.controlId,
              effectiveness: ctrlDoc.effectiveness,
              reduces: ctrlDoc.reduces as "likelihood" | "impact",
              status: "implemented" as const,
            };
          })
          .filter(Boolean) as Array<{
          id: string;
          effectiveness: number;
          reduces: "likelihood" | "impact";
          status: "implemented";
        }>;

        const projRes = computeResidual({
          likelihood: r.likelihood,
          impact: r.impact,
          treatment: "mitigate",
          controls: resolvedControls,
        });
        projectedScores.push(projRes.score);
      } else {
        // Other treatments keep their stored residual
        projectedScores.push(r.residualScore);
      }
    }

    const projectedSummary = summarize(projectedScores);
    const projected = {
      score: projectedSummary.overall,
      level: overallLevel(projectedSummary.overall),
      delta: projectedSummary.overall - residualOverall.score,
      risksAffected,
    };

    // 5. Snapshot comparison
    let snapshotComparison: DashboardDTO["snapshotComparison"] = null;
    if (latestSnapshot) {
      const snapTyped = latestSnapshot as unknown as IAssessment;
      let snapScore = snapTyped.overallScore;

      if (options.basis === "inherent") {
        if (typeof snapTyped.inherentOverall === "number") {
          snapScore = snapTyped.inherentOverall;
        } else if (snapTyped.perRiskSnapshots && snapTyped.perRiskSnapshots.length > 0) {
          snapScore = summarize(snapTyped.perRiskSnapshots.map((p) => p.inherentScore)).overall;
        } else {
          snapScore = 0;
        }
      }

      const liveScore = options.basis === "residual" ? residualOverall.score : inherentOverall.score;
      snapshotComparison = {
        label: snapTyped.label,
        date: snapTyped.date.toISOString(),
        score: snapScore,
        delta: liveScore - snapScore,
      };
    }

    // 6. Distribution (always 4 entries Low..Critical, zero-filled)
    const distribution: DashboardDTO["distribution"] = [
      { level: "Low", count: basisSummary.counts.Low },
      { level: "Medium", count: basisSummary.counts.Medium },
      { level: "High", count: basisSummary.counts.High },
      { level: "Critical", count: basisSummary.counts.Critical },
    ];

    // 7. Threat Category Distribution
    const categoryMap = new Map<
      string,
      { category: string; Low: number; Medium: number; High: number; Critical: number; total: number }
    >();

    const knownThreatCategories = ["Cyber", "Physical", "Environmental", "Human"];
    for (const cat of knownThreatCategories) {
      categoryMap.set(cat, {
        category: cat,
        Low: 0,
        Medium: 0,
        High: 0,
        Critical: 0,
        total: 0,
      });
    }

    for (const r of includedRisks) {
      const threat = threatMap.get(r.threatId);
      const cat = threat?.category || "Unknown";
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, {
          category: cat,
          Low: 0,
          Medium: 0,
          High: 0,
          Critical: 0,
          total: 0,
        });
      }
      const item = categoryMap.get(cat)!;
      const s = options.basis === "inherent" ? r.inherentScore : r.residualScore;
      const lvl = level(s);
      item[lvl]++;
      item.total++;
    }

    const byCategory = Array.from(categoryMap.values());

    // 8. Top 10 Risks (by basis score desc, ties riskId asc)
    const topRisksList = [...includedRisks].sort((a, b) => {
      const aScore = options.basis === "inherent" ? a.inherentScore : a.residualScore;
      const bScore = options.basis === "inherent" ? b.inherentScore : b.residualScore;
      const diff = bScore - aScore;
      if (diff !== 0) return diff;
      return a.riskId.localeCompare(b.riskId);
    });

    const topRisks: DashboardDTO["topRisks"] = topRisksList.slice(0, 10).map((r) => {
      const asset = assetMap.get(r.assetId.toString());
      const scoreVal = options.basis === "inherent" ? r.inherentScore : r.residualScore;
      return {
        riskId: r.riskId,
        assetName: asset?.name || "Unknown Asset",
        threatName: threatNameMap.get(r.threatId) || r.threatId,
        vulnerabilityName: vulnNameMap.get(r.vulnerabilityId) || r.vulnerabilityId,
        score: scoreVal,
        level: level(scoreVal),
        inherentScore: r.inherentScore,
        residualScore: r.residualScore,
        status: r.status,
      };
    });

    // 9. Vulnerable Assets (top 10 by maxScore desc, ties name asc)
    const risksByAssetId = new Map<string, typeof includedRisks>();
    for (const r of includedRisks) {
      const aId = r.assetId.toString();
      const existing = risksByAssetId.get(aId) || [];
      existing.push(r);
      risksByAssetId.set(aId, existing);
    }

    const allAssetRows: AssetRiskRow[] = assets.map((a) => {
      const aRisks = risksByAssetId.get(a._id.toString()) || [];
      return buildAssetRiskRow(a, aRisks, threatNameMap, options.basis);
    });

    allAssetRows.sort((a, b) => {
      const diff = b.maxScore - a.maxScore;
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name);
    });

    const vulnerableAssets = allAssetRows.slice(0, 10);

    // 10. Inherent vs Residual (top 10 by INHERENT score desc, ties riskId asc)
    const inherentSorted = [...includedRisks].sort((a, b) => {
      const diff = b.inherentScore - a.inherentScore;
      if (diff !== 0) return diff;
      return a.riskId.localeCompare(b.riskId);
    });

    const inherentVsResidual: DashboardDTO["inherentVsResidual"] = inherentSorted
      .slice(0, 10)
      .map((r) => {
        const asset = assetMap.get(r.assetId.toString());
        const assetName = asset?.name || "Unknown Asset";
        return {
          riskId: r.riskId,
          label: `${r.riskId} ${assetName}`,
          inherent: r.inherentScore,
          residual: r.residualScore,
        };
      });

    // 11. Control Implementation
    let plannedControlsCount = 0;
    let implementedControlsCount = 0;
    const controlCategoryMap = new Map<string, { category: string; planned: number; implemented: number }>();

    const knownControlCategories = ["Technical", "Administrative", "Physical"];
    for (const cat of knownControlCategories) {
      controlCategoryMap.set(cat, { category: cat, planned: 0, implemented: 0 });
    }

    for (const r of includedRisks) {
      for (const c of (r.controls as Array<{ controlId: string; status: string }>)) {
        const ctrlDoc = controlMap.get(c.controlId);
        const cat = ctrlDoc?.category || "Unknown";

        if (!controlCategoryMap.has(cat)) {
          controlCategoryMap.set(cat, { category: cat, planned: 0, implemented: 0 });
        }
        const item = controlCategoryMap.get(cat)!;

        if (c.status === "implemented") {
          implementedControlsCount++;
          item.implemented++;
        } else if (c.status === "planned") {
          plannedControlsCount++;
          item.planned++;
        }
      }
    }

    const totalControls = plannedControlsCount + implementedControlsCount;
    const percentImplemented =
      totalControls === 0 ? 0 : roundTo((implementedControlsCount / totalControls) * 100, 0);

    const controlImplementation = {
      planned: plannedControlsCount,
      implemented: implementedControlsCount,
      total: totalControls,
      percentImplemented,
      byCategory: Array.from(controlCategoryMap.values()),
    };

    // 12. Dynamic Bands
    const riskBands = (["Low", "Medium", "High", "Critical"] as const).map((lvl) => ({
      level: lvl,
      ...levelRange(lvl),
    }));

    const bands = {
      risk: riskBands,
      overall: computeOverallBands(),
    };

    // 13. Live Trend Point
    const live = {
      overallScore: residualOverall.score,
      inherentOverall: inherentOverall.score,
      maxScore: residualSummary.max,
      counts: residualSummary.counts,
      date: generatedAt,
    };

    return {
      basis: options.basis,
      generatedAt,
      totals: {
        assets: assets.length,
        includedRisks: includedRisks.length,
        closedRisks: closedRiskCount,
      },
      overall,
      inherentOverall,
      residualOverall,
      projected,
      snapshotComparison,
      distribution,
      byCategory,
      topRisks,
      vulnerableAssets,
      inherentVsResidual,
      controlImplementation,
      bands,
      trend,
      live,
    };
  },
};
