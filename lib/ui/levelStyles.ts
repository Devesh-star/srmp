import { RiskLevel } from "@/lib/riskEngine";

export const LEVEL_HEX: Record<RiskLevel, string> = {
  Low: "#10b981", // Emerald 500
  Medium: "#f59e0b", // Amber 500
  High: "#f97316", // Orange 500
  Critical: "#f43f5e", // Rose 500
};

export const LEVEL_BADGE_CLASSES: Record<RiskLevel, string> = {
  Low: "bg-emerald-950/80 text-emerald-400 border-emerald-700",
  Medium: "bg-amber-950/80 text-amber-400 border-amber-700",
  High: "bg-orange-950/80 text-orange-400 border-orange-700",
  Critical: "bg-rose-950/80 text-rose-400 border-rose-700",
};

export const LEVEL_CELL_CLASSES: Record<RiskLevel, string> = {
  Low: "bg-emerald-950/40 border-emerald-800/60 text-emerald-300 hover:bg-emerald-900/60",
  Medium: "bg-amber-950/40 border-amber-800/60 text-amber-300 hover:bg-amber-900/60",
  High: "bg-orange-950/40 border-orange-800/60 text-orange-300 hover:bg-orange-900/60",
  Critical: "bg-rose-950/40 border-rose-800/60 text-rose-300 hover:bg-rose-900/60",
};

export const LEVEL_TEXT_CLASSES: Record<RiskLevel, string> = {
  Low: "text-emerald-400",
  Medium: "text-amber-400",
  High: "text-orange-400",
  Critical: "text-rose-400",
};

export function getLevelHex(level: string | null | undefined): string {
  if (level === "Low" || level === "Medium" || level === "High" || level === "Critical") {
    return LEVEL_HEX[level];
  }
  return "#94a3b8"; // Slate 400
}

export function getLevelBadgeClasses(level: string | null | undefined): string {
  if (level === "Low" || level === "Medium" || level === "High" || level === "Critical") {
    return LEVEL_BADGE_CLASSES[level];
  }
  return "bg-slate-800 text-slate-400 border-slate-700";
}

export function getLevelBadgeParts(level: string | null | undefined): { bg: string; text: string; border: string } {
  switch (level) {
    case "Low":
      return { bg: "bg-emerald-950/80", text: "text-emerald-400", border: "border-emerald-700" };
    case "Medium":
      return { bg: "bg-amber-950/80", text: "text-amber-400", border: "border-amber-700" };
    case "High":
      return { bg: "bg-orange-950/80", text: "text-orange-400", border: "border-orange-700" };
    case "Critical":
      return { bg: "bg-rose-950/80", text: "text-rose-400", border: "border-rose-700" };
    default:
      return { bg: "bg-slate-800", text: "text-slate-400", border: "border-slate-700" };
  }
}

export function getLevelCellClasses(level: string | null | undefined): string {
  if (level === "Low" || level === "Medium" || level === "High" || level === "Critical") {
    return LEVEL_CELL_CLASSES[level];
  }
  return "bg-slate-900 border-slate-800 text-slate-400";
}

export function getLevelTextClasses(level: string | null | undefined): string {
  if (level === "Low" || level === "Medium" || level === "High" || level === "Critical") {
    return LEVEL_TEXT_CLASSES[level];
  }
  return "text-slate-400";
}

export function getStatusBadgeClasses(status: string | null | undefined): string {
  switch (status) {
    case "Open":
      return "bg-rose-950/80 text-rose-300 border-rose-700";
    case "In Treatment":
      return "bg-amber-950/80 text-amber-300 border-amber-700";
    case "Mitigated":
      return "bg-emerald-950/80 text-emerald-300 border-emerald-700";
    case "Accepted":
      return "bg-indigo-950/80 text-indigo-300 border-indigo-700";
    case "Closed":
      return "bg-slate-800 text-slate-400 border-slate-600";
    default:
      return "bg-slate-800 text-slate-300 border-slate-700";
  }
}
