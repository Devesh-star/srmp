import { AssetType, Severity, CostLevel } from "@/data/types";
import { simulate, RiskPoint } from "@/lib/riskEngine";

export interface ThreatRow {
  key: string;
  name: string;
  applicableAssetTypes: AssetType[];
  vulnerabilityKeys: string[];
}

export interface VulnerabilityRow {
  key: string;
  name: string;
  severity: Severity;
  applicableAssetTypes: AssetType[];
  recommendedControlKeys: string[];
}

export interface ControlRow {
  key: string;
  name: string;
  effectiveness: number;
  reduces: "likelihood" | "impact";
  implementationCost: CostLevel;
  category: "Technical" | "Administrative" | "Physical";
}

export interface LibraryView {
  threats: ThreatRow[];
  vulnerabilities: VulnerabilityRow[];
  controls: ControlRow[];
}

export class RecommendationError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "RecommendationError";
  }
}

const SEVERITY_WEIGHT = { Critical: 4, High: 3, Medium: 2, Low: 1 };
const COST_WEIGHT = { Low: 1, Medium: 2, High: 3 };

export function cascadeThreats(view: LibraryView, input: { assetType: AssetType }) {
  const threats = view.threats.filter(t => t.applicableAssetTypes.includes(input.assetType));
  return threats.sort((a, b) => a.name.localeCompare(b.name));
}

export function cascadeVulnerabilities(view: LibraryView, input: { assetType: AssetType; threatKey: string }) {
  const threat = view.threats.find(t => t.key === input.threatKey);
  if (!threat) return [];

  const vuls = view.vulnerabilities.filter(v => 
    threat.vulnerabilityKeys.includes(v.key) && 
    v.applicableAssetTypes.includes(input.assetType)
  );

  return vuls.sort((a, b) => {
    const sDiff = SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity];
    if (sDiff !== 0) return sDiff;
    return a.name.localeCompare(b.name);
  });
}

export interface RecommendationInput {
  assetType: AssetType;
  threatKey: string;
  vulnerabilityKey: string;
  likelihood?: number;
  impact?: number;
  excludeControlKeys?: string[];
}

export function recommendControls(view: LibraryView, input: RecommendationInput) {
  const threat = view.threats.find(t => t.key === input.threatKey);
  if (!threat) throw new RecommendationError("UNKNOWN_THREAT", "Unknown threat key");

  const vulnerability = view.vulnerabilities.find(v => v.key === input.vulnerabilityKey);
  if (!vulnerability) throw new RecommendationError("UNKNOWN_VULNERABILITY", "Unknown vulnerability key");

  if (!threat.applicableAssetTypes.includes(input.assetType)) {
    throw new RecommendationError("THREAT_NOT_APPLICABLE", "Threat doesn't apply to assetType");
  }

  if (!vulnerability.applicableAssetTypes.includes(input.assetType)) {
    throw new RecommendationError("VULNERABILITY_NOT_APPLICABLE", "Vulnerability doesn't apply to assetType");
  }

  if (!threat.vulnerabilityKeys.includes(input.vulnerabilityKey)) {
    throw new RecommendationError("VULNERABILITY_NOT_LINKED", "Vulnerability isn't linked to the threat");
  }

  const excluded = new Set(input.excludeControlKeys || []);
  const recommendedKeys = vulnerability.recommendedControlKeys.filter(k => !excluded.has(k));
  
  const controls: ControlRow[] = [];
  const warnings: string[] = [];

  for (const k of recommendedKeys) {
    const c = view.controls.find(x => x.key === k);
    if (c) controls.push(c);
    else warnings.push(`Control key missing from library: ${k}`);
  }

  // Ranking: effectiveness desc, implementationCost asc, name asc
  controls.sort((a, b) => {
    if (b.effectiveness !== a.effectiveness) return b.effectiveness - a.effectiveness;
    const cDiff = COST_WEIGHT[a.implementationCost] - COST_WEIGHT[b.implementationCost];
    if (cDiff !== 0) return cDiff;
    return a.name.localeCompare(b.name);
  });

  const recommendations = controls.map((c, i) => {
    const pct = Math.round(c.effectiveness * 100);
    const cost = c.implementationCost.toLowerCase();
    const cat = c.category.toLowerCase();
    const reason = `Reduces ${c.reduces} by an estimated ${pct}% (${cat} control, ${cost} cost).`;
    return { control: c, rank: i + 1, reason };
  });

  let baseline: RiskPoint | undefined;
  let projectedFinal: RiskPoint | undefined;
  const recsWithScores = recommendations.map(r => ({ ...r, scoreBefore: 0, scoreAfter: 0, delta: 0, levelAfter: undefined as any }));

  if (input.likelihood !== undefined && input.impact !== undefined) {
    const simControls = controls.map(c => ({ id: c.key, effectiveness: c.effectiveness, reduces: c.reduces }));
    // Simulate deltas depend on order due to diminishing returns
    const sim = simulate(input.likelihood, input.impact, simControls);
    baseline = sim.baseline;
    projectedFinal = sim.final;

    sim.steps.forEach((step, idx) => {
      recsWithScores[idx].scoreBefore = step.scoreBefore;
      recsWithScores[idx].scoreAfter = step.scoreAfter;
      recsWithScores[idx].delta = step.delta;
      recsWithScores[idx].levelAfter = step.levelAfter;
    });
  }

  return {
    threat,
    vulnerability,
    recommendations: input.likelihood !== undefined ? recsWithScores : recommendations,
    warnings,
    baseline,
    projectedFinal
  };
}
