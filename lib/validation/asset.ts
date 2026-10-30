import { z } from "zod";
import { ASSET_TYPES } from "@/data/types";

export const assetCreateSchema = z
  .object({
    name: z.string().trim().min(1, "Asset name is required").max(120, "Name too long"),
    type: z.enum(ASSET_TYPES),
    owner: z.string().trim().min(1, "Owner is required").max(120, "Owner too long"),
    confidentiality: z.number().int().min(1).max(5),
    integrity: z.number().int().min(1).max(5),
    availability: z.number().int().min(1).max(5),
    description: z.string().trim().max(1000).optional().default(""),
  })
  .strict();

export const assetListQuerySchema = z.object({
  q: z.string().optional(),
  type: z.enum(ASSET_TYPES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  page: z.coerce.number().int().min(1).default(1),
});

export type AssetCreateInput = z.infer<typeof assetCreateSchema>;
export type AssetListQuery = z.infer<typeof assetListQuerySchema>;
