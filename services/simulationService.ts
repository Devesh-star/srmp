import { Risk, IRisk } from "@/models/Risk";
import { Control } from "@/models/Control";
import {
  simulate,
  AppliedControl,
  RiskPoint,
  level,
  RiskLevel,
} from "@/lib/riskEngine";
import { AppError } from "@/lib/errors";

export interface SimulationStepDTO {
  controlKey: string;
  controlName: string;
  reduces: "likelihood" | "impact";
  effectiveness: number;
  likelihood: number;
  impact: number;
  scoreBefore: number;
  scoreAfter: number;
  delta: number;
  levelAfter: RiskLevel;
}

export interface SimulationDTO {
  riskId: string;
  treatment: string;
  baseline: RiskPoint;
  steps: SimulationStepDTO[];
  final: RiskPoint;
  current: RiskPoint;
}

/**
 * Simulates the effect of applying a set of controls to a risk in a specific order.
 *
 * NOTE: Step deltas depend on the order in which controls are applied (due to
 * compounding/diminishing returns), while the final score is commutative.
 *
 * This operation is strictly READ-ONLY:
 * - No database mutations
 * - No audit log entries
 * - Works under any treatment (starts simulation from the INHERENT likelihood/impact)
 */
export async function simulateRisk(
  ctx: { organizationId: string },
  riskId: string,
  input: { controlKeys: string[] }
): Promise<SimulationDTO> {
  // 1. Load the risk scoped by organization
  const riskDoc = await Risk.findOne({
    organizationId: ctx.organizationId,
    riskId,
  }).lean();

  if (!riskDoc) {
    throw new AppError(404, "Risk not found");
  }

  const doc = riskDoc as unknown as IRisk;

  // 2. Resolve controls in the library visible to this organization
  const keys = input.controlKeys;
  let orderedControls: AppliedControl[] = [];
  const controlNameMap = new Map<string, { name: string; reduces: "likelihood" | "impact"; effectiveness: number }>();

  if (keys.length > 0) {
    const controlDocs = await Control.find({
      key: { $in: keys },
      organizationId: { $in: [null, ctx.organizationId] },
    })
      .select("key name reduces effectiveness")
      .lean();

    const docMap = new Map(controlDocs.map((c) => [c.key, c]));

    const missingKeys = keys.filter((k) => !docMap.has(k));
    if (missingKeys.length > 0) {
      throw new AppError(
        400,
        `Unknown or inaccessible control keys: ${missingKeys.join(", ")}`
      );
    }

    // Preserve the caller-specified ORDER
    orderedControls = keys.map((key) => {
      const c = docMap.get(key)!;
      controlNameMap.set(key, {
        name: c.name,
        reduces: c.reduces as "likelihood" | "impact",
        effectiveness: c.effectiveness,
      });
      return {
        id: c.key,
        effectiveness: c.effectiveness,
        reduces: c.reduces as "likelihood" | "impact",
      };
    });
  }

  // 3. Run simulation starting from INHERENT likelihood and impact
  const simResult = simulate(doc.likelihood, doc.impact, orderedControls);

  // 4. Map steps with control names and metadata
  const steps: SimulationStepDTO[] = simResult.steps.map((step) => {
    const meta = controlNameMap.get(step.controlId);
    return {
      controlKey: step.controlId,
      controlName: meta?.name ?? "Unknown control",
      reduces: meta?.reduces ?? "likelihood",
      effectiveness: meta?.effectiveness ?? 0,
      likelihood: step.likelihood,
      impact: step.impact,
      scoreBefore: step.scoreBefore,
      scoreAfter: step.scoreAfter,
      delta: step.delta,
      levelAfter: step.levelAfter,
    };
  });

  // Current stored residual risk point
  const current: RiskPoint = {
    likelihood: doc.residualLikelihood,
    impact: doc.residualImpact,
    score: doc.residualScore,
    level: level(doc.residualScore),
  };

  return {
    riskId: doc.riskId,
    treatment: doc.treatment,
    baseline: simResult.baseline,
    steps,
    final: simResult.final,
    current,
  };
}
