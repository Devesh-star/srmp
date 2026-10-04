export const ASSET_TYPES = [
  'Database',
  'Server',
  'Web Application',
  'Mobile Application',
  'Laptop',
  'Network Device',
  'Cloud Resource',
  'API',
  'Document',
  'Physical Equipment',
] as const;

export type AssetType = typeof ASSET_TYPES[number];

export type CiaTarget = "C" | "I" | "A";
export type Severity = "Low" | "Medium" | "High" | "Critical";
export type CostLevel = "Low" | "Medium" | "High";

export interface ThreatSeed {
  id: string;
  name: string;
  category: "Cyber" | "Physical" | "Environmental" | "Human";
  description: string;
  potentialImpact: string;
  ciaTarget: CiaTarget;
  applicableAssetTypes: AssetType[];
  vulnerabilityIds: string[];
}

export interface VulnerabilitySeed {
  id: string;
  name: string;
  description: string;
  severity: Severity;
  applicableAssetTypes: AssetType[];
  recommendedControlIds: string[];
}

export interface ControlSeed {
  id: string;
  name: string;
  category: "Technical" | "Administrative" | "Physical";
  description: string;
  effectiveness: number;
  reduces: "likelihood" | "impact";
  implementationCost: CostLevel;
}
