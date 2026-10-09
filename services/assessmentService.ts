import mongoose from "mongoose";
import { Assessment, IAssessment } from "@/models/Assessment";
import { Risk } from "@/models/Risk";
import { Asset } from "@/models/Asset";
import {
  summarize,
  level,
  overallLevel,
  RiskLevel,
} from "@/lib/riskEngine";
import { logAudit } from "@/lib/audit";
import { AppError } from "@/lib/errors";

export interface Ctx {
  organizationId: string;
  actorId: string;
}

export interface AssessmentSummaryDTO {
  id: string;
  label: string;
  date: string;
  createdBy: string;
  createdByName: string;
  overallScore: number;
  overallLevel: RiskLevel;
  maxScore: number;
  maxLevel: RiskLevel;
  totalRisks: number;
  counts: {
    Low: number;
    Medium: number;
    High: number;
    Critical: number;
  };
  inherentOverall: number;
}

export interface AssessmentDetailRiskDTO {
  riskId: string;
  assetId: string;
  assetName: string;
  inherentScore: number;
  residualScore: number;
  level: string;
  status: string;
}

export interface AssessmentDetailDTO extends AssessmentSummaryDTO {
  risks: AssessmentDetailRiskDTO[];
}

export interface AssessmentTrendItemDTO {
  id: string;
  label: string;
  date: string;
  overallScore: number;
  inherentOverall: number;
  maxScore: number;
  counts: {
    Low: number;
    Medium: number;
    High: number;
    Critical: number;
  };
}

function formatDateLabel(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `Assessment ${y}-${m}-${day}`;
}

export const assessmentService = {
  /**
   * Creates an immutable snapshot of all non-Closed risks in the organization.
   * `options` are internal-only parameters (e.g. for seed / backfill).
   */
  async createAssessment(
    ctx: Ctx,
    input: { label?: string },
    options?: { asOf?: Date; maxRisks?: number }
  ): Promise<AssessmentDetailDTO> {
    const maxRisks = options?.maxRisks ?? 5000;
    const now = options?.asOf ?? new Date();

    // 1. Count non-Closed risks
    const riskCount = await Risk.countDocuments({
      organizationId: ctx.organizationId,
      status: { $ne: "Closed" },
    });

    if (riskCount > maxRisks) {
      throw new AppError(409, "Too many risks to snapshot");
    }

    // 2. Load non-Closed risks
    const risks = await Risk.find({
      organizationId: ctx.organizationId,
      status: { $ne: "Closed" },
    })
      .select("riskId assetId inherentScore residualScore status")
      .lean();

    // 3. Summarize residual scores
    const residualScores = risks.map((r) => r.residualScore);
    const residualSummary = summarize(residualScores);

    // 4. Summarize inherent scores
    const inherentScores = risks.map((r) => r.inherentScore);
    const inherentSummary = summarize(inherentScores);

    // 5. Build per-risk snapshots
    const perRiskSnapshots = risks.map((r) => ({
      riskId: r.riskId,
      assetId: r.assetId,
      inherentScore: r.inherentScore,
      residualScore: r.residualScore,
      level: level(r.residualScore),
      status: r.status,
    }));

    const label = input.label?.trim() || formatDateLabel(now);

    // 6. Save immutable assessment
    const created = await Assessment.create({
      organizationId: ctx.organizationId,
      label,
      date: now,
      createdBy: ctx.actorId,
      overallScore: residualSummary.overall,
      maxScore: residualSummary.max,
      totalRisks: residualSummary.total,
      counts: residualSummary.counts,
      inherentOverall: inherentSummary.overall,
      perRiskSnapshots,
    });

    // 7. Resolve asset names for response
    const assetIds = [...new Set(risks.map((r) => r.assetId.toString()))];
    const assetDocs = assetIds.length
      ? await Asset.find({
          _id: { $in: assetIds.map((id) => new mongoose.Types.ObjectId(id)) },
        })
          .select("_id name")
          .lean()
      : [];
    const assetNameMap = new Map(assetDocs.map((a) => [a._id.toString(), a.name]));

    const riskDTOs: AssessmentDetailRiskDTO[] = perRiskSnapshots.map((r) => ({
      riskId: r.riskId,
      assetId: r.assetId.toString(),
      assetName: assetNameMap.get(r.assetId.toString()) ?? "Unknown asset",
      inherentScore: r.inherentScore,
      residualScore: r.residualScore,
      level: r.level,
      status: r.status,
    }));

    const summaryDto: AssessmentSummaryDTO = {
      id: created._id.toString(),
      label: created.label,
      date: created.date.toISOString(),
      createdBy: created.createdBy,
      createdByName: created.createdBy,
      overallScore: created.overallScore,
      overallLevel: overallLevel(created.overallScore),
      maxScore: created.maxScore,
      maxLevel: level(created.maxScore),
      totalRisks: created.totalRisks,
      counts: created.counts,
      inherentOverall: created.inherentOverall,
    };

    const detailDto: AssessmentDetailDTO = {
      ...summaryDto,
      risks: riskDTOs,
    };

    // 8. Log audit
    await logAudit(
      "assessment.create",
      { actor: ctx.actorId, organizationId: ctx.organizationId },
      {
        entityId: created._id.toString(),
        before: null,
        after: summaryDto,
      }
    );

    return detailDto;
  },

  /**
   * Lists snapshots newest first with pagination.
   */
  async listAssessments(
    ctx: { organizationId: string },
    query: { page: number; limit: number }
  ) {
    const filter = { organizationId: ctx.organizationId };
    const skip = (query.page - 1) * query.limit;

    const [docs, total] = await Promise.all([
      Assessment.find(filter)
        .sort({ date: -1 })
        .skip(skip)
        .limit(query.limit)
        .lean(),
      Assessment.countDocuments(filter),
    ]);

    const items: AssessmentSummaryDTO[] = docs.map((doc) => {
      const inherentScores = ((doc as unknown as IAssessment).perRiskSnapshots || []).map(
        (r: { inherentScore: number }) => r.inherentScore
      );
      const computedInherentOverall = inherentScores.length
        ? summarize(inherentScores).overall
        : (doc as unknown as IAssessment).inherentOverall ?? 0;

      return {
        id: doc._id.toString(),
        label: doc.label,
        date: doc.date.toISOString(),
        createdBy: doc.createdBy,
        createdByName: doc.createdBy,
        overallScore: doc.overallScore,
        overallLevel: overallLevel(doc.overallScore),
        maxScore: doc.maxScore,
        maxLevel: level(doc.maxScore),
        totalRisks: doc.totalRisks,
        counts: doc.counts,
        inherentOverall: computedInherentOverall,
      };
    });

    return {
      items,
      total,
      page: query.page,
      limit: query.limit,
    };
  },

  /**
   * Retrieves single assessment snapshot by id with resolved asset names.
   */
  async getAssessment(
    ctx: { organizationId: string },
    id: string
  ): Promise<AssessmentDetailDTO> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError(404, "Assessment not found");
    }

    const doc = await Assessment.findOne({
      _id: new mongoose.Types.ObjectId(id),
      organizationId: ctx.organizationId,
    }).lean();

    if (!doc) {
      throw new AppError(404, "Assessment not found");
    }

    const typedDoc = doc as unknown as IAssessment;

    const assetIds = [
      ...new Set(typedDoc.perRiskSnapshots.map((r) => r.assetId.toString())),
    ];
    const assetDocs = assetIds.length
      ? await Asset.find({
          _id: { $in: assetIds.map((aid) => new mongoose.Types.ObjectId(aid)) },
        })
          .select("_id name")
          .lean()
      : [];
    const assetNameMap = new Map(
      assetDocs.map((a) => [a._id.toString(), a.name])
    );

    const inherentScores = typedDoc.perRiskSnapshots.map((r) => r.inherentScore);
    const computedInherentOverall = inherentScores.length
      ? summarize(inherentScores).overall
      : typedDoc.inherentOverall ?? 0;

    const risks: AssessmentDetailRiskDTO[] = typedDoc.perRiskSnapshots.map((r) => ({
      riskId: r.riskId,
      assetId: r.assetId.toString(),
      assetName: assetNameMap.get(r.assetId.toString()) ?? "Unknown asset",
      inherentScore: r.inherentScore,
      residualScore: r.residualScore,
      level: r.level,
      status: r.status,
    }));

    return {
      id: typedDoc._id.toString(),
      label: typedDoc.label,
      date: typedDoc.date.toISOString(),
      createdBy: typedDoc.createdBy,
      createdByName: typedDoc.createdBy,
      overallScore: typedDoc.overallScore,
      overallLevel: overallLevel(typedDoc.overallScore),
      maxScore: typedDoc.maxScore,
      maxLevel: level(typedDoc.maxScore),
      totalRisks: typedDoc.totalRisks,
      counts: typedDoc.counts,
      inherentOverall: computedInherentOverall,
      risks,
    };
  },

  /**
   * Deletes an assessment snapshot (admin only, audited).
   */
  async deleteAssessment(ctx: Ctx, id: string): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError(404, "Assessment not found");
    }

    const doc = await Assessment.findOne({
      _id: new mongoose.Types.ObjectId(id),
      organizationId: ctx.organizationId,
    }).lean();

    if (!doc) {
      throw new AppError(404, "Assessment not found");
    }

    const summaryDto: AssessmentSummaryDTO = {
      id: doc._id.toString(),
      label: doc.label,
      date: doc.date.toISOString(),
      createdBy: doc.createdBy,
      createdByName: doc.createdBy,
      overallScore: doc.overallScore,
      overallLevel: overallLevel(doc.overallScore),
      maxScore: doc.maxScore,
      maxLevel: level(doc.maxScore),
      totalRisks: doc.totalRisks,
      counts: doc.counts,
      inherentOverall: doc.inherentOverall ?? 0,
    };

    await Assessment.deleteOne({
      _id: doc._id,
      organizationId: ctx.organizationId,
    });

    await logAudit(
      "assessment.delete",
      { actor: ctx.actorId, organizationId: ctx.organizationId },
      {
        entityId: doc._id.toString(),
        before: summaryDto,
        after: null,
      }
    );
  },

  /**
   * Returns latest `limit` snapshots ordered OLDEST to NEWEST for trending.
   */
  async getTrend(
    ctx: { organizationId: string },
    options: { limit: number }
  ): Promise<AssessmentTrendItemDTO[]> {
    const docs = await Assessment.find({
      organizationId: ctx.organizationId,
    })
      .sort({ date: -1 })
      .limit(options.limit)
      .lean();

    // Reverse to chronological order (OLDEST to NEWEST)
    const reversed = docs.reverse();

    return reversed.map((doc) => {
      const inherentScores = ((doc as unknown as IAssessment).perRiskSnapshots || []).map(
        (r: { inherentScore: number }) => r.inherentScore
      );
      const computedInherentOverall = inherentScores.length
        ? summarize(inherentScores).overall
        : (doc as unknown as IAssessment).inherentOverall ?? 0;

      return {
        id: doc._id.toString(),
        label: doc.label,
        date: doc.date.toISOString(),
        overallScore: doc.overallScore,
        inherentOverall: computedInherentOverall,
        maxScore: doc.maxScore,
        counts: doc.counts,
      };
    });
  },
};
