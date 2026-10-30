import mongoose from "mongoose";
import { Asset, IAsset } from "@/models/Asset";
import { AppError } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { AssetCreateInput, AssetListQuery } from "@/lib/validation/asset";

export interface AssetCtx {
  organizationId: string;
  actorId: string;
}

export interface AssetDTO {
  id: string;
  name: string;
  type: string;
  owner: string;
  confidentiality: number;
  integrity: number;
  availability: number;
  criticality: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

function toDTO(doc: IAsset): AssetDTO {
  const criticality = Math.max(doc.confidentiality, doc.integrity, doc.availability);
  return {
    id: doc._id.toString(),
    name: doc.name,
    type: doc.type,
    owner: doc.owner,
    confidentiality: doc.confidentiality,
    integrity: doc.integrity,
    availability: doc.availability,
    criticality,
    description: doc.description || "",
    createdAt: doc.createdAt ? doc.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: doc.updatedAt ? doc.updatedAt.toISOString() : new Date().toISOString(),
  };
}

export const assetService = {
  async createAsset(ctx: AssetCtx, input: AssetCreateInput): Promise<AssetDTO> {
    // Check for duplicate name in same organization (case-insensitive)
    const escapedName = input.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const existing = await Asset.findOne({
      organizationId: ctx.organizationId,
      name: { $regex: new RegExp(`^${escapedName}$`, "i") },
    }).lean();

    if (existing) {
      throw new AppError(409, `An asset named "${input.name}" already exists`);
    }

    const doc = await Asset.create({
      organizationId: ctx.organizationId,
      name: input.name,
      type: input.type,
      owner: input.owner,
      confidentiality: input.confidentiality,
      integrity: input.integrity,
      availability: input.availability,
      description: input.description || "",
    });

    const dto = toDTO(doc);

    await logAudit("asset.create", { actor: ctx.actorId, organizationId: ctx.organizationId }, {
      entityId: doc._id.toString(),
      after: dto,
    });

    return dto;
  },

  async listAssets(
    ctx: AssetCtx,
    query: AssetListQuery
  ): Promise<{ items: AssetDTO[]; total: number; page: number; limit: number }> {
    const filter: Record<string, unknown> = {
      organizationId: ctx.organizationId,
    };

    if (query.type) {
      filter.type = query.type;
    }

    if (query.q && query.q.trim()) {
      const escaped = query.q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { name: { $regex: escaped, $options: "i" } },
        { owner: { $regex: escaped, $options: "i" } },
      ];
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 50));
    const skip = (page - 1) * limit;

    const [docs, total] = await Promise.all([
      Asset.find(filter).sort({ name: 1 }).skip(skip).limit(limit),
      Asset.countDocuments(filter),
    ]);

    return {
      items: docs.map(toDTO),
      total,
      page,
      limit,
    };
  },

  async getAssetById(ctx: AssetCtx, id: string): Promise<AssetDTO> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError(404, "Asset not found");
    }

    const doc = await Asset.findOne({
      _id: new mongoose.Types.ObjectId(id),
      organizationId: ctx.organizationId,
    });

    if (!doc) {
      throw new AppError(404, "Asset not found");
    }

    return toDTO(doc);
  },
};
