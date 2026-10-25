import { RiskLevel, roundTo } from "@/lib/riskEngine";
import { simulatorParamsSchema } from "@/lib/validation/dashboard";
import { AssessmentTrendItemDTO } from "@/services/assessmentService";

export const levelOrder: readonly RiskLevel[] = ["Low", "Medium", "High", "Critical"] as const;

export interface DistributionChartItem {
  name: RiskLevel;
  level: RiskLevel;
  count: number;
}

export function toDistributionSeries(
  distribution: Array<{ level: RiskLevel; count: number }>
): DistributionChartItem[] {
  return distribution.map((item) => ({
    name: item.level,
    level: item.level,
    count: item.count,
  }));
}

export interface CategoryChartItem {
  category: string;
  Low: number;
  Medium: number;
  High: number;
  Critical: number;
  total: number;
}

export function toCategorySeries(
  byCategory: Array<{
    category: string;
    Low: number;
    Medium: number;
    High: number;
    Critical: number;
    total: number;
  }>
): CategoryChartItem[] {
  return byCategory.map((item) => ({
    category: item.category,
    Low: item.Low,
    Medium: item.Medium,
    High: item.High,
    Critical: item.Critical,
    total: item.total,
  }));
}

export interface TrendChartItem extends AssessmentTrendItemDTO {
  isLive?: boolean;
}

export function mergeTrendWithLive(
  trend: AssessmentTrendItemDTO[],
  live: {
    overallScore: number;
    inherentOverall: number;
    maxScore: number;
    counts: Record<RiskLevel, number>;
    date: string;
  }
): TrendChartItem[] {
  const result: TrendChartItem[] = trend.map((t) => ({ ...t, isLive: false }));
  result.push({
    id: "live",
    label: "Live",
    date: live.date,
    overallScore: live.overallScore,
    inherentOverall: live.inherentOverall,
    maxScore: live.maxScore,
    counts: live.counts,
    isLive: true,
  });
  return result;
}

export type ChangeDirection = "down" | "up" | "same";

export interface ChangeDescription {
  direction: ChangeDirection;
  text: string;
}

export function describeChange(delta: number): ChangeDescription {
  if (Math.abs(delta) < 0.05) {
    return { direction: "same", text: "same" };
  }
  const rounded = roundTo(Math.abs(delta), 1);
  if (delta < 0) {
    return { direction: "down", text: `down ${rounded}` };
  }
  return { direction: "up", text: `up ${rounded}` };
}

export function moveItem<T>(array: readonly T[], index: number, direction: "up" | "down"): T[] {
  if (index < 0 || index >= array.length) {
    return [...array];
  }
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= array.length) {
    return [...array];
  }
  const copy = [...array];
  const temp = copy[index];
  copy[index] = copy[targetIndex];
  copy[targetIndex] = temp;
  return copy;
}

export interface SimulatorParsedParams {
  riskId?: string;
  controls: string[];
}

export function parseSimulatorParams(
  searchParams:
    | URLSearchParams
    | Record<string, string | string[] | undefined>
    | string
    | undefined
): SimulatorParsedParams {
  if (!searchParams) {
    return { controls: [] };
  }

  let riskIdRaw: string | undefined;
  let controlsRaw: string | undefined;

  if (typeof searchParams === "string") {
    const clean = searchParams.startsWith("?") ? searchParams.slice(1) : searchParams;
    const sp = new URLSearchParams(clean);
    riskIdRaw = sp.get("riskId") ?? undefined;
    controlsRaw = sp.get("controls") ?? undefined;
  } else if (searchParams instanceof URLSearchParams) {
    riskIdRaw = searchParams.get("riskId") ?? undefined;
    controlsRaw = searchParams.get("controls") ?? undefined;
  } else {
    const r = searchParams.riskId;
    riskIdRaw = Array.isArray(r) ? r[0] : r;
    const c = searchParams.controls;
    controlsRaw = Array.isArray(c) ? c.join(",") : c;
  }

  const parsed = simulatorParamsSchema.safeParse({
    riskId: riskIdRaw,
    controls: controlsRaw,
  });

  if (!parsed.success) {
    // If riskId was invalid, simulatorParamsSchema fails. Retry parsing controls only.
    const controlsOnly = simulatorParamsSchema.safeParse({ controls: controlsRaw });
    return {
      riskId: undefined,
      controls: controlsOnly.success ? controlsOnly.data.controls : [],
    };
  }

  return {
    riskId: parsed.data.riskId,
    controls: parsed.data.controls,
  };
}

export function buildSimulatorUrl(riskId?: string, controlKeys?: string[]): string {
  const params = new URLSearchParams();
  if (riskId) {
    params.set("riskId", riskId);
  }
  if (controlKeys && controlKeys.length > 0) {
    params.set("controls", controlKeys.join(","));
  }
  const q = params.toString();
  return q ? `/simulator?${q}` : "/simulator";
}
