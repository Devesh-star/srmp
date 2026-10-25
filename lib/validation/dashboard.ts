import { z } from "zod";
import { ASSET_TYPES } from "@/data/types";

export const riskIdSchema = z.string().regex(/^R\d{3,}$/, "Invalid risk ID format");
export const controlKeySchema = z.string().regex(/^ctl_[a-z0-9_]{1,60}$/, "Invalid control key");

export const dashboardQuerySchema = z
  .object({
    basis: z.enum(["inherent", "residual"]).default("residual"),
    trendLimit: z.coerce.number().int().min(1).max(60).default(12),
  })
  .strict();

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

export const assetRiskQuerySchema = z
  .object({
    basis: z.enum(["inherent", "residual"]).default("residual"),
    q: z
      .string()
      .max(100)
      .transform((val) => val.trim())
      .optional(),
    type: z.enum(ASSET_TYPES).optional(),
    sort: z.enum(["maxScore", "totalScore", "criticality", "name"]).default("maxScore"),
    order: z.enum(["asc", "desc"]).default("desc"),
    includeUnassessed: z
      .enum(["true", "false"])
      .default("true")
      .transform((v) => v === "true"),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export type AssetRiskQuery = z.infer<typeof assetRiskQuerySchema>;

export const assetRiskDetailQuerySchema = z
  .object({
    basis: z.enum(["inherent", "residual"]).default("residual"),
    includeClosed: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
  })
  .strict();

export type AssetRiskDetailQuery = z.infer<typeof assetRiskDetailQuerySchema>;

/**
 * Parses and validates simulator URL search params.
 * Invalid control keys are dropped, duplicates removed, and list is capped at 20.
 */
export const simulatorParamsSchema = z.object({
  riskId: riskIdSchema.optional(),
  controls: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return [];
      const parts = val.split(",").map((s) => s.trim()).filter(Boolean);
      const valid = parts.filter((k) => controlKeySchema.safeParse(k).success);
      return Array.from(new Set(valid)).slice(0, 20);
    }),
});

export type SimulatorParams = z.infer<typeof simulatorParamsSchema>;
