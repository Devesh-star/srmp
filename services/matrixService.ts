import mongoose from "mongoose";
import { Risk } from "@/models/Risk";
import { Asset } from "@/models/Asset";
import { Threat } from "@/models/Threat";
import { score, level, roundTo } from "@/lib/riskEngine";

export interface MatrixCellRisk {
  riskId: string;
  assetName: string;
  threatName: string;
  score: number;
}

export interface MatrixCell {
  likelihood: number;
  impact: number;
  cellScore: number;
  level: string;
  count: number;
  risks: MatrixCellRisk[]; // max 50 per cell, sorted score desc then riskId asc
}

export interface MatrixResult {
  basis: "inherent" | "residual";
  cells: MatrixCell[]; // always 25 entries (L1-5 × I1-5)
  notPlotted: number;
  totalPlotted: number;
}

export const matrixService = {
  async getMatrix(
    ctx: { organizationId: string },
    options: {
      basis: "inherent" | "residual";
      assetId?: string;
      includeClosed: boolean;
    }
  ): Promise<MatrixResult> {
    // Build filter
    const filter: Record<string, unknown> = {
      organizationId: ctx.organizationId,
    };
    if (!options.includeClosed) {
      filter.status = { $ne: "Closed" };
    }
    if (options.assetId) {
      filter.assetId = new mongoose.Types.ObjectId(options.assetId);
    }

    const risks = await Risk.find(filter)
      .select(
        "riskId assetId threatId likelihood impact residualLikelihood residualImpact residualScore inherentScore status"
      )
      .lean();

    // Pre-build all 25 cells (L1-5, I1-5)
    const cellMap = new Map<string, { count: number; risks: MatrixCellRisk[] }>();
    for (let l = 1; l <= 5; l++) {
      for (let i = 1; i <= 5; i++) {
        cellMap.set(`${l}:${i}`, { count: 0, risks: [] });
      }
    }

    // Resolve asset and threat names in bulk
    const assetIds = [...new Set(risks.map((r) => r.assetId.toString()))];
    const threatIds = [...new Set(risks.map((r) => r.threatId))];

    const [assetDocs, threatDocs] = await Promise.all([
      Asset.find({ _id: { $in: assetIds.map((id) => new mongoose.Types.ObjectId(id)) } })
        .select("_id name")
        .lean(),
      Threat.find({ key: { $in: threatIds }, organizationId: { $in: [null, ctx.organizationId] } })
        .select("key name")
        .lean(),
    ]);

    const assetNameMap = new Map(assetDocs.map((a) => [a._id.toString(), a.name]));
    const threatNameMap = new Map(threatDocs.map((t) => [t.key, t.name]));

    let notPlotted = 0;
    let totalPlotted = 0;

    for (const risk of risks) {
      let plotL: number;
      let plotI: number;
      let plotScore: number;

      if (options.basis === "inherent") {
        plotL = risk.likelihood;
        plotI = risk.impact;
        plotScore = risk.inherentScore;
      } else {
        // Residual: round to nearest whole rating, clamp to 1..5
        // If score is 0 (avoided), count as notPlotted
        if (risk.residualScore === 0) {
          notPlotted++;
          continue;
        }
        plotL = Math.min(5, Math.max(1, Math.round(roundTo(risk.residualLikelihood, 0))));
        plotI = Math.min(5, Math.max(1, Math.round(roundTo(risk.residualImpact, 0))));
        plotScore = risk.residualScore;
      }

      const key = `${plotL}:${plotI}`;
      const cell = cellMap.get(key)!;
      cell.count++;
      totalPlotted++;

      if (cell.risks.length < 50) {
        cell.risks.push({
          riskId: risk.riskId,
          assetName: assetNameMap.get(risk.assetId.toString()) ?? "Unknown",
          threatName: threatNameMap.get(risk.threatId) ?? "Unknown",
          score: plotScore,
        });
      }
    }

    // Sort each cell's risks: score desc, then riskId asc
    for (const cell of cellMap.values()) {
      cell.risks.sort((a, b) => b.score - a.score || a.riskId.localeCompare(b.riskId));
    }

    // Build the 25-cell array
    const cells: MatrixCell[] = [];
    for (let l = 1; l <= 5; l++) {
      for (let i = 1; i <= 5; i++) {
        const cellScore = score(l, i); // l * i via engine
        const cellLevel = level(cellScore); // fixed colour grid, independent of risk decimals
        const cell = cellMap.get(`${l}:${i}`)!;
        cells.push({
          likelihood: l,
          impact: i,
          cellScore,
          level: cellLevel,
          count: cell.count,
          risks: cell.risks,
        });
      }
    }

    return { basis: options.basis, cells, notPlotted, totalPlotted };
  },
};
