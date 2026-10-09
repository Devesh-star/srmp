import mongoose from "mongoose";
import { Risk, IRisk, IRiskControl } from "@/models/Risk";
import { Asset, IAsset } from "@/models/Asset";
import { Threat } from "@/models/Threat";
import { Vulnerability } from "@/models/Vulnerability";
import { Control } from "@/models/Control";
import { AuditLog } from "@/models/AuditLog";
import { computeScoresFor } from "@/services/riskScoring";
import { logAudit } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import { nextSequence, formatRiskId } from "@/lib/sequence";
import { deriveStatus } from "@/lib/riskStatus";
import {
  suggestedImpact,
  inherentScore,
  level,
  levelRange,
  summarize,
} from "@/lib/riskEngine";
import {
  validateCombination,
  RecommendationError,
  LibraryView,
} from "@/lib/recommendations";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Ctx {
  organizationId: string;
  actorId: string;
}

export interface RiskDTOControl {
  key: string;
  name: string;
  category: string;
  reduces: "likelihood" | "impact";
  effectiveness: number;
  implementationCost: string;
  status: "planned" | "implemented";
  implementedAt: string | null;
}

export interface RiskDTOTreatmentDetails {
  justification?: string;
  approver?: string;
  reviewDate?: string | null;
  avoidReason?: string;
  transferFactor?: number;
}

export interface RiskDTO {
  id: string;
  riskId: string;
  asset: { id: string; name: string; type: string };
  threat: { key: string; name: string; ciaTarget: string };
  vulnerability: { key: string; name: string; severity: string };
  likelihood: number;
  impact: number;
  suggestedImpact: number;
  impactOverridden: boolean;
  inherentScore: number;
  inherentLevel: string;
  residualLikelihood: number;
  residualImpact: number;
  residualScore: number;
  residualLevel: string;
  treatment: string;
  treatmentDetails: RiskDTOTreatmentDetails | null;
  status: string;
  closedManually: boolean;
  owner: string;
  dueDate: string | null;
  notes: string;
  controls: RiskDTOControl[];
  controlsImplemented: number;
  controlsTotal: number;
  createdAt: string;
  updatedAt: string;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function getLibraryView(organizationId: string): Promise<LibraryView> {
  const [threats, vulnerabilities, controls] = await Promise.all([
    Threat.find({ organizationId: { $in: [null, organizationId] } }).lean(),
    Vulnerability.find({ organizationId: { $in: [null, organizationId] } }).lean(),
    Control.find({ organizationId: { $in: [null, organizationId] } }).lean(),
  ]);

  return {
    threats: threats as unknown as LibraryView["threats"],
    vulnerabilities: vulnerabilities as unknown as LibraryView["vulnerabilities"],
    controls: controls as unknown as LibraryView["controls"],
  };
}

async function toDTO(
  doc: IRisk,
  organizationId: string
): Promise<RiskDTO> {
  // Resolve asset
  const assetDoc = await Asset.findOne({
    _id: doc.assetId,
    organizationId,
  })
    .select("name type")
    .lean();

  // Resolve threat & vulnerability (org-visible)
  const threatDoc = await Threat.findOne({
    key: doc.threatId,
    organizationId: { $in: [null, organizationId] },
  })
    .select("name ciaTarget")
    .lean();

  const vulDoc = await Vulnerability.findOne({
    key: doc.vulnerabilityId,
    organizationId: { $in: [null, organizationId] },
  })
    .select("name severity")
    .lean();

  // Resolve controls (tolerant: missing controls render gracefully for reads)
  const controlKeys = doc.controls.map((c) => c.controlId);
  const controlDocs = controlKeys.length
    ? await Control.find({
        key: { $in: controlKeys },
        organizationId: { $in: [null, organizationId] },
      }).lean()
    : [];

  const controlDocMap = new Map(controlDocs.map((c) => [c.key, c]));

  const resolvedControls: RiskDTOControl[] = doc.controls.map((c) => {
    const found = controlDocMap.get(c.controlId);
    if (found) {
      return {
        key: found.key,
        name: found.name,
        category: found.category,
        reduces: found.reduces as "likelihood" | "impact",
        effectiveness: found.effectiveness,
        implementationCost: found.implementationCost,
        status: c.status,
        implementedAt: c.implementedAt ?? null,
      };
    }
    return {
      key: c.controlId,
      name: "Unknown control",
      category: "Other",
      reduces: "likelihood",
      effectiveness: 0,
      implementationCost: "Low",
      status: c.status,
      implementedAt: c.implementedAt ?? null,
    };
  });

  // Compute suggestedImpact from current asset CIA (may have changed since creation)
  let computedSuggestedImpact = doc.suggestedImpact;
  if (assetDoc && threatDoc) {
    try {
      computedSuggestedImpact = suggestedImpact(
        {
          confidentiality: (assetDoc as unknown as IAsset).confidentiality,
          integrity: (assetDoc as unknown as IAsset).integrity,
          availability: (assetDoc as unknown as IAsset).availability,
        },
        threatDoc.ciaTarget as "C" | "I" | "A"
      );
    } catch {
      computedSuggestedImpact = doc.suggestedImpact;
    }
  }

  const isClosedManually = doc.status === "Closed" && doc.treatment !== "avoid";

  return {
    id: doc._id.toString(),
    riskId: doc.riskId,
    asset: assetDoc
      ? { id: doc.assetId.toString(), name: assetDoc.name, type: assetDoc.type }
      : { id: doc.assetId.toString(), name: "Unknown", type: "Unknown" },
    threat: threatDoc
      ? { key: doc.threatId, name: threatDoc.name, ciaTarget: threatDoc.ciaTarget }
      : { key: doc.threatId, name: "Unknown", ciaTarget: "Unknown" },
    vulnerability: vulDoc
      ? { key: doc.vulnerabilityId, name: vulDoc.name, severity: vulDoc.severity }
      : { key: doc.vulnerabilityId, name: "Unknown", severity: "Unknown" },
    likelihood: doc.likelihood,
    impact: doc.impact,
    suggestedImpact: computedSuggestedImpact,
    impactOverridden: doc.impact !== computedSuggestedImpact,
    inherentScore: doc.inherentScore,
    inherentLevel: level(doc.inherentScore),
    residualLikelihood: doc.residualLikelihood,
    residualImpact: doc.residualImpact,
    residualScore: doc.residualScore,
    residualLevel: level(doc.residualScore),
    treatment: doc.treatment,
    treatmentDetails: (doc.treatmentDetails as RiskDTOTreatmentDetails) ?? null,
    status: doc.status,
    closedManually: isClosedManually,
    owner: doc.owner,
    dueDate: doc.dueDate ?? null,
    notes: doc.notes,
    controls: resolvedControls,
    controlsImplemented: doc.controls.filter((c) => c.status === "implemented").length,
    controlsTotal: doc.controls.length,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

/**
 * Shared helper for all risk mutations with optimistic concurrency control.
 */
async function applyRiskChange(
  ctx: Ctx,
  riskId: string,
  expectedUpdatedAt: string,
  build: (doc: IRisk) => Promise<Record<string, unknown>>
): Promise<{ beforeDto: RiskDTO; updatedDoc: IRisk; afterDto: RiskDTO }> {
  const existing = await Risk.findOne({
    organizationId: ctx.organizationId,
    riskId,
  }).lean();

  if (!existing) {
    throw new AppError(404, "Risk not found");
  }

  if (existing.updatedAt.toISOString() !== expectedUpdatedAt) {
    throw new AppError(
      409,
      "This risk was changed by someone else. Reload and try again."
    );
  }

  const updates = await build(existing as unknown as IRisk);

  const updated = await Risk.findOneAndUpdate(
    {
      organizationId: ctx.organizationId,
      riskId,
      updatedAt: new Date(expectedUpdatedAt),
    },
    { $set: updates },
    { returnDocument: "after", new: true }
  ).lean();

  if (!updated) {
    const stillExists = await Risk.findOne({
      organizationId: ctx.organizationId,
      riskId,
    })
      .select("_id")
      .lean();

    if (!stillExists) {
      throw new AppError(404, "Risk not found");
    }
    throw new AppError(
      409,
      "This risk was changed by someone else. Reload and try again."
    );
  }

  const beforeDto = await toDTO(existing as unknown as IRisk, ctx.organizationId);
  const afterDto = await toDTO(updated as unknown as IRisk, ctx.organizationId);

  return {
    beforeDto,
    updatedDoc: updated as unknown as IRisk,
    afterDto,
  };
}

// ── Public service ────────────────────────────────────────────────────────────

export const riskService = {
  // ── createRisk ──────────────────────────────────────────────────────────────
  async createRisk(
    ctx: Ctx,
    input: {
      assetId: string;
      threatKey: string;
      vulnerabilityKey: string;
      likelihood: number;
      impact: number;
      owner: string;
      dueDate?: string;
      notes?: string;
    }
  ): Promise<RiskDTO> {
    // 1. Load asset (scoped to org)
    const assetDoc = await Asset.findOne({
      _id: new mongoose.Types.ObjectId(input.assetId),
      organizationId: ctx.organizationId,
    }).lean();
    if (!assetDoc) throw new AppError(404, "Asset not found");

    // 2. Validate combination via library
    const view = await getLibraryView(ctx.organizationId);
    let threat: LibraryView["threats"][0];
    try {
      const result = validateCombination(view, {
        assetType: assetDoc.type,
        threatKey: input.threatKey,
        vulnerabilityKey: input.vulnerabilityKey,
      });
      threat = result.threat;
    } catch (e) {
      if (e instanceof RecommendationError) {
        throw new AppError(400, e.code);
      }
      throw e;
    }

    // 3. Duplicate check: existing non-Closed risk for same org+asset+threat+vulnerability
    const existingActive = await Risk.findOne({
      organizationId: ctx.organizationId,
      assetId: assetDoc._id,
      threatId: input.threatKey,
      vulnerabilityId: input.vulnerabilityKey,
      status: { $ne: "Closed" },
    }).lean();

    if (existingActive) {
      throw new AppError(
        409,
        `An active risk already exists for this combination: ${existingActive.riskId}`
      );
    }

    // 4. Compute CIA suggested impact
    const calculatedSuggestedImpact = suggestedImpact(
      {
        confidentiality: assetDoc.confidentiality,
        integrity: assetDoc.integrity,
        availability: assetDoc.availability,
      },
      (threat as unknown as { ciaTarget: string }).ciaTarget as "C" | "I" | "A"
    );
    const isOverridden = input.impact !== calculatedSuggestedImpact;

    // 5. Inherent and initial residual scoring (treatment=mitigate, no controls => residual = inherent)
    const iScore = inherentScore(input.likelihood, input.impact);
    const iLevel = level(iScore);

    // 6. Allocate sequence
    const seq = await nextSequence(ctx.organizationId, "risk");
    const riskId = formatRiskId(seq);

    // 7. Initial status derived via pure logic (mitigate with no controls => Open)
    const initialStatus = deriveStatus({ treatment: "mitigate", controls: [] });

    // 8. Insert document
    const created = await Risk.create({
      organizationId: ctx.organizationId,
      riskId,
      assetId: assetDoc._id,
      threatId: input.threatKey,
      vulnerabilityId: input.vulnerabilityKey,
      likelihood: input.likelihood,
      impact: input.impact,
      suggestedImpact: calculatedSuggestedImpact,
      impactOverridden: isOverridden,
      inherentScore: iScore,
      inherentLevel: iLevel,
      residualLikelihood: input.likelihood,
      residualImpact: input.impact,
      residualScore: iScore,
      residualLevel: iLevel,
      treatment: "mitigate",
      treatmentDetails: null,
      controls: [],
      status: initialStatus,
      owner: input.owner,
      dueDate: input.dueDate ?? null,
      notes: input.notes ?? "",
    });

    const dto = await toDTO(created, ctx.organizationId);

    // 9. Audit log
    await logAudit("risk.create", { actor: ctx.actorId, organizationId: ctx.organizationId }, {
      entityId: created._id.toString(),
      before: null,
      after: dto,
    });

    return dto;
  },

  // ── listRisks ───────────────────────────────────────────────────────────────
  async listRisks(
    ctx: Ctx,
    query: {
      q?: string;
      level?: string;
      basis: "inherent" | "residual";
      status?: string;
      owner?: string;
      assetId?: string;
      sort: string;
      order: "asc" | "desc";
      page: number;
      limit: number;
    }
  ) {
    const filter: Record<string, unknown> = {
      organizationId: ctx.organizationId,
    };

    // Status filter
    if (query.status) {
      filter.status = query.status;
    }

    // Owner filter
    if (query.owner) {
      filter.owner = { $regex: escapeRegex(query.owner), $options: "i" };
    }

    // Asset filter
    if (query.assetId) {
      filter.assetId = new mongoose.Types.ObjectId(query.assetId);
    }

    // Level filter via levelRange()
    if (query.level) {
      const scoreField =
        query.basis === "inherent" ? "inherentScore" : "residualScore";
      const range = levelRange(query.level as "Low" | "Medium" | "High" | "Critical");
      const levelFilter: Record<string, unknown> = { [scoreField]: { $gte: range.gte } };
      if (range.lt !== null) {
        (levelFilter[scoreField] as Record<string, number>).$lt = range.lt;
      }
      Object.assign(filter, levelFilter);
    }

    // Text search (q): resolve matching entities then build $or
    if (query.q) {
      const escaped = escapeRegex(query.q);
      const re = { $regex: escaped, $options: "i" };

      const [matchingAssets, matchingThreats, matchingVuls] = await Promise.all([
        Asset.find({ organizationId: ctx.organizationId, name: re })
          .select("_id")
          .lean(),
        Threat.find({
          organizationId: { $in: [null, ctx.organizationId] },
          name: re,
        })
          .select("key")
          .lean(),
        Vulnerability.find({
          organizationId: { $in: [null, ctx.organizationId] },
          name: re,
        })
          .select("key")
          .lean(),
      ]);

      filter.$or = [
        { riskId: re },
        { owner: re },
        ...(matchingAssets.length
          ? [{ assetId: { $in: matchingAssets.map((a) => a._id) } }]
          : []),
        ...(matchingThreats.length
          ? [{ threatId: { $in: matchingThreats.map((t) => t.key) } }]
          : []),
        ...(matchingVuls.length
          ? [{ vulnerabilityId: { $in: matchingVuls.map((v) => v.key) } }]
          : []),
      ];
    }

    // Sorting — "riskId" sort maps to createdAt (sequence order)
    const sortFieldMap: Record<string, string> = {
      riskId: "createdAt",
      inherentScore: "inherentScore",
      residualScore: "residualScore",
      dueDate: "dueDate",
      updatedAt: "updatedAt",
    };
    const sortField = sortFieldMap[query.sort] ?? "createdAt";
    const sortOrder = query.order === "desc" ? -1 : 1;

    // Nulls-last for dueDate
    const sortSpec: Record<string, 1 | -1> =
      sortField === "dueDate"
        ? { dueDate: sortOrder, createdAt: 1 }
        : { [sortField]: sortOrder, createdAt: 1 };

    const skip = (query.page - 1) * query.limit;

    const [docs, total] = await Promise.all([
      Risk.find(filter).sort(sortSpec).skip(skip).limit(query.limit).lean(),
      Risk.countDocuments(filter),
    ]);

    // Summary over ALL matching scores (not just the page)
    const scoreField =
      query.basis === "inherent" ? "inherentScore" : "residualScore";
    const allScoreDocs = await Risk.find(filter)
      .select(scoreField)
      .lean();
    const allScores = allScoreDocs.map(
      (d) => (d as Record<string, number>)[scoreField] ?? 0
    );
    const summary = summarize(allScores);

    const items = await Promise.all(
      docs.map((d) => toDTO(d as unknown as IRisk, ctx.organizationId))
    );

    return { items, total, page: query.page, limit: query.limit, summary };
  },

  // ── getRisk ─────────────────────────────────────────────────────────────────
  async getRisk(ctx: Ctx, riskId: string): Promise<RiskDTO> {
    const doc = await Risk.findOne({
      organizationId: ctx.organizationId,
      riskId,
    }).lean();
    if (!doc) throw new AppError(404, "Risk not found");
    return toDTO(doc as unknown as IRisk, ctx.organizationId);
  },

  // ── updateRisk ──────────────────────────────────────────────────────────────
  async updateRisk(
    ctx: Ctx,
    riskId: string,
    input: {
      likelihood: number;
      impact: number;
      owner: string;
      dueDate?: string | null;
      notes: string;
      expectedUpdatedAt: string;
    }
  ): Promise<RiskDTO> {
    const { beforeDto, updatedDoc, afterDto } = await applyRiskChange(
      ctx,
      riskId,
      input.expectedUpdatedAt,
      async (doc) => {
        // Guard: manually closed risks reject edit
        if (doc.status === "Closed" && doc.treatment !== "avoid") {
          throw new AppError(409, "Reopen the risk before editing it");
        }

        // Re-resolve suggestedImpact from current asset
        const assetDoc = await Asset.findOne({
          _id: doc.assetId,
          organizationId: ctx.organizationId,
        }).lean();
        const threatDoc = await Threat.findOne({
          key: doc.threatId,
          organizationId: { $in: [null, ctx.organizationId] },
        })
          .select("ciaTarget")
          .lean();

        let newSuggestedImpact = doc.suggestedImpact;
        if (assetDoc && threatDoc) {
          try {
            newSuggestedImpact = suggestedImpact(
              {
                confidentiality: assetDoc.confidentiality,
                integrity: assetDoc.integrity,
                availability: assetDoc.availability,
              },
              threatDoc.ciaTarget as "C" | "I" | "A"
            );
          } catch {
            newSuggestedImpact = doc.suggestedImpact;
          }
        }
        const newImpactOverridden = input.impact !== newSuggestedImpact;

        // Re-compute scores
        let scores;
        if (doc.treatment === "avoid") {
          scores = {
            inherentScore: inherentScore(input.likelihood, input.impact),
            residualLikelihood: 0,
            residualImpact: 0,
            residualScore: 0,
          };
        } else {
          scores = await computeScoresFor(ctx, {
            likelihood: input.likelihood,
            impact: input.impact,
            treatment: doc.treatment,
            controls: doc.controls,
            transferFactor: doc.transferFactor,
          });
        }

        return {
          likelihood: input.likelihood,
          impact: input.impact,
          suggestedImpact: newSuggestedImpact,
          impactOverridden: newImpactOverridden,
          inherentScore: scores.inherentScore,
          inherentLevel: level(scores.inherentScore),
          residualLikelihood: scores.residualLikelihood,
          residualImpact: scores.residualImpact,
          residualScore: scores.residualScore,
          residualLevel: level(scores.residualScore),
          owner: input.owner,
          dueDate:
            input.dueDate !== undefined
              ? input.dueDate ?? null
              : doc.dueDate,
          notes: input.notes,
        };
      }
    );

    await logAudit(
      "risk.update",
      { actor: ctx.actorId, organizationId: ctx.organizationId },
      {
        entityId: updatedDoc._id.toString(),
        before: beforeDto,
        after: afterDto,
      }
    );

    return afterDto;
  },

  // ── setRiskControls ─────────────────────────────────────────────────────────
  async setRiskControls(
    ctx: Ctx,
    riskId: string,
    input: {
      controls: { controlKey: string; status: "planned" | "implemented" }[];
      expectedUpdatedAt: string;
    }
  ): Promise<RiskDTO> {
    // Validate that all control keys are visible to org
    const keys = input.controls.map((c) => c.controlKey);
    if (keys.length > 0) {
      const foundControls = await Control.find({
        key: { $in: keys },
        organizationId: { $in: [null, ctx.organizationId] },
      })
        .select("key")
        .lean();

      const foundSet = new Set(foundControls.map((c) => c.key));
      const missing = keys.filter((k) => !foundSet.has(k));
      if (missing.length > 0) {
        throw new AppError(
          400,
          `Unknown or inaccessible control keys: ${missing.join(", ")}`
        );
      }
    }

    const { beforeDto, updatedDoc, afterDto } = await applyRiskChange(
      ctx,
      riskId,
      input.expectedUpdatedAt,
      async (doc) => {
        // Guard: manually closed
        if (doc.status === "Closed" && doc.treatment !== "avoid") {
          throw new AppError(409, "Reopen the risk before editing it");
        }

        // Guard: treatment must be mitigate
        if (doc.treatment !== "mitigate") {
          throw new AppError(
            409,
            "Controls only count under the Mitigate treatment. Change the treatment first."
          );
        }

        // Build new controls array with proper implementedAt handling
        const existingMap = new Map(
          doc.controls.map((c) => [c.controlId, c])
        );
        const nowIso = new Date().toISOString();

        const newControls: IRiskControl[] = input.controls.map((c) => {
          const prev = existingMap.get(c.controlKey);
          let implementedAt: string | null = null;
          if (c.status === "implemented") {
            if (prev && prev.status === "implemented" && prev.implementedAt) {
              implementedAt = prev.implementedAt;
            } else {
              implementedAt = nowIso;
            }
          }
          return {
            controlId: c.controlKey,
            status: c.status,
            implementedAt,
          };
        });

        // Recompute scores
        const scores = await computeScoresFor(ctx, {
          likelihood: doc.likelihood,
          impact: doc.impact,
          treatment: doc.treatment,
          controls: newControls,
          transferFactor: doc.transferFactor,
        });

        // Derive operational status
        const newStatus = deriveStatus({
          treatment: doc.treatment,
          controls: newControls,
        });

        return {
          controls: newControls,
          residualLikelihood: scores.residualLikelihood,
          residualImpact: scores.residualImpact,
          residualScore: scores.residualScore,
          residualLevel: level(scores.residualScore),
          status: newStatus,
        };
      }
    );

    await logAudit(
      "risk.controls.update",
      { actor: ctx.actorId, organizationId: ctx.organizationId },
      {
        entityId: updatedDoc._id.toString(),
        before: beforeDto,
        after: afterDto,
      }
    );

    return afterDto;
  },

  // ── setRiskTreatment ────────────────────────────────────────────────────────
  async setRiskTreatment(
    ctx: Ctx,
    riskId: string,
    input: {
      treatment: "mitigate" | "accept" | "transfer" | "avoid";
      justification?: string;
      approver?: string;
      reviewDate?: string | null;
      transferFactor?: number;
      avoidReason?: string;
      expectedUpdatedAt: string;
    },
    userRole?: string
  ): Promise<RiskDTO> {
    const { beforeDto, updatedDoc, afterDto } = await applyRiskChange(
      ctx,
      riskId,
      input.expectedUpdatedAt,
      async (doc) => {
        // Guard: manually closed (unless avoiding)
        if (doc.status === "Closed" && doc.treatment !== "avoid") {
          throw new AppError(409, "Reopen the risk before editing it");
        }

        // Governance rule: accepting a Critical inherent risk requires admin role
        if (input.treatment === "accept") {
          const inhLevel = level(inherentScore(doc.likelihood, doc.impact));
          if (inhLevel === "Critical" && userRole !== "admin") {
            throw new AppError(403, "Only an admin can accept a Critical risk");
          }
        }

        let treatmentDetails: Record<string, unknown> | null = null;
        let transferFactor: number | undefined = undefined;

        if (input.treatment === "accept") {
          treatmentDetails = {
            justification: input.justification,
            approver: input.approver,
            reviewDate: input.reviewDate,
          };
        } else if (input.treatment === "transfer") {
          treatmentDetails = {
            justification: input.justification,
            transferFactor: input.transferFactor,
            reviewDate: input.reviewDate ?? null,
          };
          transferFactor = input.transferFactor;
        } else if (input.treatment === "avoid") {
          treatmentDetails = {
            avoidReason: input.avoidReason,
          };
        }

        // Recompute scores
        let scores;
        if (input.treatment === "avoid") {
          scores = {
            inherentScore: inherentScore(doc.likelihood, doc.impact),
            residualLikelihood: 0,
            residualImpact: 0,
            residualScore: 0,
          };
        } else {
          scores = await computeScoresFor(ctx, {
            likelihood: doc.likelihood,
            impact: doc.impact,
            treatment: input.treatment,
            controls: doc.controls,
            transferFactor,
          });
        }

        const newStatus = deriveStatus({
          treatment: input.treatment,
          controls: doc.controls,
        });

        return {
          treatment: input.treatment,
          treatmentDetails,
          transferFactor: transferFactor ?? null,
          residualLikelihood: scores.residualLikelihood,
          residualImpact: scores.residualImpact,
          residualScore: scores.residualScore,
          residualLevel: level(scores.residualScore),
          status: newStatus,
        };
      }
    );

    await logAudit(
      "risk.treatment.update",
      { actor: ctx.actorId, organizationId: ctx.organizationId },
      {
        entityId: updatedDoc._id.toString(),
        before: beforeDto,
        after: afterDto,
      }
    );

    return afterDto;
  },

  // ── closeRisk ───────────────────────────────────────────────────────────────
  async closeRisk(
    ctx: Ctx,
    riskId: string,
    input: { reason: string; expectedUpdatedAt: string }
  ): Promise<RiskDTO> {
    const { beforeDto, updatedDoc, afterDto } = await applyRiskChange(
      ctx,
      riskId,
      input.expectedUpdatedAt,
      async (doc) => {
        if (doc.status === "Closed" && doc.treatment !== "avoid") {
          throw new AppError(409, "Risk is already closed");
        }
        if (doc.treatment === "avoid") {
          throw new AppError(
            409,
            "Risks with the Avoid treatment are closed automatically; change the treatment to reopen"
          );
        }

        return {
          status: "Closed",
        };
      }
    );

    await logAudit(
      "risk.close",
      { actor: ctx.actorId, organizationId: ctx.organizationId },
      {
        entityId: updatedDoc._id.toString(),
        before: beforeDto,
        after: { ...afterDto, statusChangeReason: input.reason },
      }
    );

    return afterDto;
  },

  // ── reopenRisk ──────────────────────────────────────────────────────────────
  async reopenRisk(
    ctx: Ctx,
    riskId: string,
    input: { expectedUpdatedAt: string }
  ): Promise<RiskDTO> {
    const { beforeDto, updatedDoc, afterDto } = await applyRiskChange(
      ctx,
      riskId,
      input.expectedUpdatedAt,
      async (doc) => {
        if (doc.status !== "Closed" || doc.treatment === "avoid") {
          throw new AppError(409, "Only manually closed risks can be reopened");
        }

        const newStatus = deriveStatus({
          treatment: doc.treatment,
          controls: doc.controls,
        });

        return {
          status: newStatus,
        };
      }
    );

    await logAudit(
      "risk.reopen",
      { actor: ctx.actorId, organizationId: ctx.organizationId },
      {
        entityId: updatedDoc._id.toString(),
        before: beforeDto,
        after: afterDto,
      }
    );

    return afterDto;
  },

  // ── deleteRisk ──────────────────────────────────────────────────────────────
  async deleteRisk(ctx: Ctx, riskId: string): Promise<void> {
    const existing = await Risk.findOne({
      organizationId: ctx.organizationId,
      riskId,
    }).lean();
    if (!existing) throw new AppError(404, "Risk not found");

    const beforeDto = await toDTO(existing as unknown as IRisk, ctx.organizationId);

    await Risk.deleteOne({ organizationId: ctx.organizationId, riskId });

    await logAudit(
      "risk.delete",
      { actor: ctx.actorId, organizationId: ctx.organizationId },
      {
        entityId: existing._id.toString(),
        before: beforeDto,
        after: null,
      }
    );
  },

  // ── getRiskHistory ──────────────────────────────────────────────────────────
  async getRiskHistory(ctx: Ctx, riskId: string) {
    const doc = await Risk.findOne({
      organizationId: ctx.organizationId,
      riskId,
    })
      .select("_id")
      .lean();
    if (!doc) throw new AppError(404, "Risk not found");

    const entityId = doc._id.toString();

    const entries = await AuditLog.find({
      organizationId: ctx.organizationId,
      entityId,
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const actionLabels: Record<string, string> = {
      "risk.create": "Risk created",
      "risk.update": "Risk updated",
      "risk.controls.update": "Controls updated",
      "risk.treatment.update": "Treatment changed",
      "risk.close": "Risk closed",
      "risk.reopen": "Risk reopened",
      "risk.delete": "Risk deleted",
    };

    return entries.map((e) => {
      const before = (e.changes?.before ?? {}) as Record<string, unknown>;
      const after = (e.changes?.after ?? {}) as Record<string, unknown>;
      const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
      const changedFields: string[] = [];
      for (const key of allKeys) {
        if (key === "updatedAt" || key === "statusChangeReason") continue;
        if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
          changedFields.push(key);
        }
      }

      const note =
        e.action === "risk.close" && after.statusChangeReason
          ? String(after.statusChangeReason)
          : undefined;

      return {
        action: e.action,
        actionLabel: actionLabels[e.action] ?? e.action,
        actorName: e.actor,
        timestamp: e.createdAt.toISOString(),
        changedFields,
        note,
      };
    });
  },
};
