import { Control } from "@/models/Control";
import { inherentScore, computeResidual, RiskControl } from "@/lib/riskEngine";
import { IRiskControl, RiskTreatment } from "@/models/Risk";

interface RiskLike {
  likelihood: number;
  impact: number;
  treatment: RiskTreatment;
  controls: IRiskControl[];
  transferFactor?: number;
  treatmentDetails?: string;
}

interface ScoreResult {
  inherentScore: number;
  residualLikelihood: number;
  residualImpact: number;
  residualScore: number;
}

/**
 * Loads the referenced controls from the database (global or org-visible),
 * maps each to the engine's RiskControl type, then calls inherentScore() and
 * computeResidual() from lib/riskEngine.ts.
 *
 * If any stored control key cannot be resolved, throws an internal Error
 * (caller should surface this as a 500). Never silently ignores missing controls.
 */
export async function computeScoresFor(
  ctx: { organizationId: string },
  riskLike: RiskLike
): Promise<ScoreResult> {
  const iScore = inherentScore(riskLike.likelihood, riskLike.impact);

  let engineControls: RiskControl[] = [];

  if (riskLike.controls.length > 0) {
    const controlIds = riskLike.controls.map((c) => c.controlId);

    const docs = await Control.find({
      key: { $in: controlIds },
      organizationId: { $in: [null, ctx.organizationId] },
    })
      .select("key effectiveness reduces")
      .lean();

    const docMap = new Map(docs.map((d) => [d.key, d]));

    engineControls = riskLike.controls.map((stored) => {
      const doc = docMap.get(stored.controlId);
      if (!doc) {
        throw new Error(
          `Control "${stored.controlId}" referenced by a risk could not be found in the library. ` +
            "The library may have been modified after the risk was created."
        );
      }
      return {
        id: doc.key,
        effectiveness: doc.effectiveness,
        reduces: doc.reduces as "likelihood" | "impact",
        status: stored.status,
      };
    });
  }

  const residualPoint = computeResidual({
    likelihood: riskLike.likelihood,
    impact: riskLike.impact,
    treatment: riskLike.treatment,
    controls: engineControls,
    transferFactor: riskLike.transferFactor,
  });

  return {
    inherentScore: iScore,
    residualLikelihood: residualPoint.likelihood,
    residualImpact: residualPoint.impact,
    residualScore: residualPoint.score,
  };
}
