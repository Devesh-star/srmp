import { z } from "zod";
import { ASSET_TYPES } from "@/data/types";

export const keySchema = z.string().regex(/^(thr|vul|ctl)_[a-z0-9_]{1,60}$/, "Invalid key format");
export const threatKeySchema = z.string().regex(/^thr_[a-z0-9_]{1,60}$/, "Invalid threat key");
export const vulnerabilityKeySchema = z.string().regex(/^vul_[a-z0-9_]{1,60}$/, "Invalid vulnerability key");
export const controlKeySchema = z.string().regex(/^ctl_[a-z0-9_]{1,60}$/, "Invalid control key");

export const threatBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.enum(["Cyber", "Physical", "Environmental", "Human"]),
  description: z.string().trim().min(1).max(500),
  potentialImpact: z.string().trim().min(1).max(300),
  ciaTarget: z.enum(["C", "I", "A"]),
  applicableAssetTypes: z.array(z.enum(ASSET_TYPES)).min(1).refine((items) => new Set(items).size === items.length, "Asset types must be unique"),
  vulnerabilityKeys: z.array(vulnerabilityKeySchema).min(1).max(10).refine((items) => new Set(items).size === items.length, "Vulnerability keys must be unique"),
}).strict();

export const vulnerabilityBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(500),
  severity: z.enum(["Low", "Medium", "High", "Critical"]),
  applicableAssetTypes: z.array(z.enum(ASSET_TYPES)).min(1).refine((items) => new Set(items).size === items.length, "Asset types must be unique"),
  recommendedControlKeys: z.array(controlKeySchema).min(1).max(10).refine((items) => new Set(items).size === items.length, "Control keys must be unique"),
}).strict();

export const controlBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.enum(["Technical", "Administrative", "Physical"]),
  description: z.string().trim().min(1).max(500),
  effectiveness: z.number().min(0.01).max(0.5),
  reduces: z.enum(["likelihood", "impact"]),
  implementationCost: z.enum(["Low", "Medium", "High"]),
}).strict();

const baseListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).default("asc"),
  scope: z.enum(["all", "global", "custom"]).default("all"),
});

export const threatListQuerySchema = baseListQuerySchema.extend({
  category: z.enum(["Cyber", "Physical", "Environmental", "Human"]).optional(),
  ciaTarget: z.enum(["C", "I", "A"]).optional(),
  assetType: z.enum(ASSET_TYPES).optional(),
  vulnerabilityKey: vulnerabilityKeySchema.optional(),
});

export const vulnerabilityListQuerySchema = baseListQuerySchema.extend({
  severity: z.enum(["Low", "Medium", "High", "Critical"]).optional(),
  assetType: z.enum(ASSET_TYPES).optional(),
  threatKey: threatKeySchema.optional(),
});

export const controlListQuerySchema = baseListQuerySchema.extend({
  category: z.enum(["Technical", "Administrative", "Physical"]).optional(),
  reduces: z.enum(["likelihood", "impact"]).optional(),
  cost: z.enum(["Low", "Medium", "High"]).optional(),
  vulnerabilityKey: vulnerabilityKeySchema.optional(),
});

export const recommendationQuerySchema = z.object({
  assetType: z.enum(ASSET_TYPES),
  threatKey: threatKeySchema,
  vulnerabilityKey: vulnerabilityKeySchema,
  likelihood: z.coerce.number().int().min(1).max(5).optional(),
  impact: z.coerce.number().int().min(1).max(5).optional(),
  excludeControlKeys: z.string().optional().transform((str) => str ? str.split(',').map(s => s.trim()) : undefined),
}).refine(data => {
  return (data.likelihood === undefined && data.impact === undefined) || 
         (data.likelihood !== undefined && data.impact !== undefined);
}, {
  message: "Both likelihood and impact must be provided, or neither",
  path: ["likelihood"]
}).refine(data => {
  if (data.excludeControlKeys) {
    return data.excludeControlKeys.length <= 20;
  }
  return true;
}, {
  message: "Max 20 excluded control keys allowed",
  path: ["excludeControlKeys"]
}).refine(data => {
  if (data.excludeControlKeys) {
    return data.excludeControlKeys.every(k => /^ctl_[a-z0-9_]{1,60}$/.test(k));
  }
  return true;
}, {
  message: "Invalid control key in excludeControlKeys",
  path: ["excludeControlKeys"]
});
