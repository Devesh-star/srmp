export type RiskLevel = "Low" | "Medium" | "High" | "Critical";
export type CiaTarget = "C" | "I" | "A";
export type Treatment = "mitigate" | "avoid" | "transfer" | "accept";
export type ControlStatus = "planned" | "implemented";

export interface AppliedControl {
  id: string;
  effectiveness: number;
  reduces: "likelihood" | "impact";
}

export interface RiskControl extends AppliedControl {
  status: ControlStatus;
}

export interface RiskPoint {
  likelihood: number;
  impact: number;
  score: number;
  level: RiskLevel;
}

export const MIN_RATING = 1;
export const MAX_RATING = 5;
export const MAX_SCORE = 25;

export function roundTo(value: number, dp: number = 1): number {
  if (typeof value !== "number") throw new TypeError("Value must be a number");
  const multiplier = Math.pow(10, dp);
  return Math.round(value * multiplier) / multiplier;
}

function validateNumber(val: unknown, min: number, max: number, name: string): void {
  if (typeof val !== "number" || isNaN(val)) {
    throw new TypeError(`${name} must be a number`);
  }
  if (!isFinite(val) || val < min || val > max) {
    throw new RangeError(`${name} must be between ${min} and ${max}`);
  }
}

function validateInteger(val: unknown, min: number, max: number, name: string): void {
  if (typeof val !== "number" || isNaN(val)) {
    throw new TypeError(`${name} must be a number`);
  }
  if (!Number.isInteger(val)) {
    throw new TypeError(`${name} must be an integer`);
  }
  if ((val as number) < min || (val as number) > max) {
    throw new RangeError(`${name} must be between ${min} and ${max}`);
  }
}

export function score(likelihood: number, impact: number): number {
  validateNumber(likelihood, MIN_RATING, MAX_RATING, "likelihood");
  validateNumber(impact, MIN_RATING, MAX_RATING, "impact");
  return likelihood * impact;
}

export function inherentScore(likelihood: number, impact: number): number {
  validateInteger(likelihood, MIN_RATING, MAX_RATING, "likelihood");
  validateInteger(impact, MIN_RATING, MAX_RATING, "impact");
  return likelihood * impact;
}

export function level(scoreVal: number): RiskLevel {
  validateNumber(scoreVal, 0, MAX_SCORE, "score");
  // Normalize floating-point noise by rounding to 9 decimal places
  const normalized = Math.round(scoreVal * 1e9) / 1e9;
  
  if (normalized < 5) return "Low";
  if (normalized < 10) return "Medium";
  if (normalized < 17) return "High";
  return "Critical";
}

export function criticality(c: number, i: number, a: number): number {
  validateInteger(c, MIN_RATING, MAX_RATING, "c");
  validateInteger(i, MIN_RATING, MAX_RATING, "i");
  validateInteger(a, MIN_RATING, MAX_RATING, "a");
  return (c + i + a) / 3;
}

export function suggestedImpact(
  asset: { confidentiality: number; integrity: number; availability: number },
  target: CiaTarget
): number {
  let val: number;
  if (target === "C") val = asset.confidentiality;
  else if (target === "I") val = asset.integrity;
  else if (target === "A") val = asset.availability;
  else throw new TypeError("Invalid target");

  validateInteger(val, MIN_RATING, MAX_RATING, "asset target value");
  return val;
}

export function residual(likelihood: number, impact: number, controls: RiskControl[]): RiskPoint {
  validateNumber(likelihood, MIN_RATING, MAX_RATING, "likelihood");
  validateNumber(impact, MIN_RATING, MAX_RATING, "impact");
  
  let factorL = 1;
  let factorI = 1;
  const seenIds = new Set<string>();

  for (const c of controls) {
    if (seenIds.has(c.id)) {
      throw new Error(`Duplicate control id: ${c.id}`);
    }
    seenIds.add(c.id);

    if (c.status === "implemented") {
      validateNumber(c.effectiveness, 0, 1, `effectiveness for ${c.id}`);
      if (c.reduces === "likelihood") {
        factorL *= (1 - c.effectiveness);
      } else if (c.reduces === "impact") {
        factorI *= (1 - c.effectiveness);
      }
    }
  }

  const resLikelihood = Math.max(1, likelihood * factorL);
  const resImpact = Math.max(1, impact * factorI);
  const resScore = resLikelihood * resImpact;

  return {
    likelihood: resLikelihood,
    impact: resImpact,
    score: resScore,
    level: level(resScore)
  };
}

export function computeResidual(input: {
  likelihood: number;
  impact: number;
  treatment: Treatment;
  controls?: RiskControl[];
  transferFactor?: number;
}): RiskPoint {
  validateNumber(input.likelihood, MIN_RATING, MAX_RATING, "likelihood");
  validateNumber(input.impact, MIN_RATING, MAX_RATING, "impact");

  // avoid: the risk is removed; return likelihood 0, impact 0, score 0, level "Low"
  if (input.treatment === "avoid") {
    return { likelihood: 0, impact: 0, score: 0, level: "Low" };
  }

  // accept: residual equals inherent (controls ignored)
  if (input.treatment === "accept") {
    const s = input.likelihood * input.impact;
    return {
      likelihood: input.likelihood,
      impact: input.impact,
      score: s,
      level: level(s)
    };
  }

  // transfer: residualImpact = max(1, impact * (1 - transferFactor))
  if (input.treatment === "transfer") {
    if (input.transferFactor === undefined) {
      throw new TypeError("transferFactor is required for transfer treatment");
    }
    validateNumber(input.transferFactor, 0, 1, "transferFactor");
    const resImpact = Math.max(1, input.impact * (1 - input.transferFactor));
    const s = input.likelihood * resImpact;
    return {
      likelihood: input.likelihood,
      impact: resImpact,
      score: s,
      level: level(s)
    };
  }

  // mitigate (default behavior matching residual function)
  const controls = input.controls || [];
  return residual(input.likelihood, input.impact, controls);
}

export interface SimulationStep {
  controlId: string;
  likelihood: number;
  impact: number;
  scoreBefore: number;
  scoreAfter: number;
  delta: number;
  levelAfter: RiskLevel;
}

export interface SimulationResult {
  baseline: RiskPoint;
  steps: SimulationStep[];
  final: RiskPoint;
}

export function simulate(likelihood: number, impact: number, orderedControls: AppliedControl[]): SimulationResult {
  validateNumber(likelihood, MIN_RATING, MAX_RATING, "likelihood");
  validateNumber(impact, MIN_RATING, MAX_RATING, "impact");

  const baselineScore = likelihood * impact;
  const baseline: RiskPoint = {
    likelihood,
    impact,
    score: baselineScore,
    level: level(baselineScore)
  };

  const steps: SimulationStep[] = [];
  let currentLikelihood = likelihood;
  let currentImpact = impact;
  let currentScore = baselineScore;
  const seenIds = new Set<string>();

  for (const c of orderedControls) {
    if (seenIds.has(c.id)) {
      throw new Error(`Duplicate control id: ${c.id}`);
    }
    seenIds.add(c.id);
    validateNumber(c.effectiveness, 0, 1, `effectiveness for ${c.id}`);

    const scoreBefore = currentScore;
    if (c.reduces === "likelihood") {
      currentLikelihood = Math.max(1, currentLikelihood * (1 - c.effectiveness));
    } else if (c.reduces === "impact") {
      currentImpact = Math.max(1, currentImpact * (1 - c.effectiveness));
    }
    
    currentScore = currentLikelihood * currentImpact;
    
    steps.push({
      controlId: c.id,
      likelihood: currentLikelihood,
      impact: currentImpact,
      scoreBefore,
      scoreAfter: currentScore,
      delta: currentScore - scoreBefore,
      levelAfter: level(currentScore)
    });
  }

  return {
    baseline,
    steps,
    final: {
      likelihood: currentLikelihood,
      impact: currentImpact,
      score: currentScore,
      level: level(currentScore)
    }
  };
}

export function summarize(scores: number[]): {
  overall: number;
  max: number;
  total: number;
  counts: Record<RiskLevel, number>;
} {
  const counts: Record<RiskLevel, number> = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  if (scores.length === 0) {
    return { overall: 0, max: 0, total: 0, counts };
  }

  let sum = 0;
  let max = 0;

  for (const s of scores) {
    validateNumber(s, 0, MAX_SCORE, "score in summarize");
    sum += s;
    if (s > max) max = s;
    counts[level(s)]++;
  }

  const overall = Math.round(100 * sum / (scores.length * 25));

  return {
    overall,
    max,
    total: scores.length,
    counts
  };
}

export function overallLevel(overall: number): RiskLevel {
  validateNumber(overall, 0, 100, "overall");
  const normalized = Math.round(overall * 1e9) / 1e9;
  
  if (normalized < 20) return "Low";
  if (normalized < 40) return "Medium";
  if (normalized < 68) return "High";
  return "Critical";
}
