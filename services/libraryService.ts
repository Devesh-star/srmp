import { Threat } from "@/models/Threat";
import { Vulnerability } from "@/models/Vulnerability";
import { Control } from "@/models/Control";
import { Risk } from "@/models/Risk";
import { logAudit } from "@/lib/audit";
import { AppError } from "@/lib/errors";

function generateKey(type: "thr" | "vul" | "ctl", name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").substring(0, 40);
  return `${type}_custom_${slug}`;
}

function escapeRegex(text: string) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

function buildSearchQuery(q?: string) {
  if (!q) return {};
  const escaped = escapeRegex(q);
  return {
    $or: [
      { name: { $regex: escaped, $options: "i" } },
      { description: { $regex: escaped, $options: "i" } }
    ]
  };
}

export const libraryService = {
  // THREATS
  async listThreats(ctx: { organizationId: string }, query: any) {
    const filter: any = { organizationId: { $in: [null, ctx.organizationId] }, ...buildSearchQuery(query.q) };
    if (query.scope === "global") filter.organizationId = null;
    if (query.scope === "custom") filter.organizationId = ctx.organizationId;
    if (query.category) filter.category = query.category;
    if (query.ciaTarget) filter.ciaTarget = query.ciaTarget;
    if (query.assetType) filter.applicableAssetTypes = query.assetType;
    if (query.vulnerabilityKey) filter.vulnerabilityKeys = query.vulnerabilityKey;

    const skip = (query.page - 1) * query.limit;
    const items = await Threat.find(filter).sort({ [query.sort || "name"]: query.order === "desc" ? -1 : 1 }).skip(skip).limit(query.limit).lean();
    const total = await Threat.countDocuments(filter);

    return {
      items: items.map(t => ({ ...t, _id: undefined, __v: undefined, organizationId: undefined, scope: t.organizationId === null ? "global" : "custom" })),
      total, page: query.page, limit: query.limit
    };
  },

  async getThreatDetail(ctx: { organizationId: string }, key: string) {
    const threat = await Threat.findOne({ key, organizationId: { $in: [null, ctx.organizationId] } }).lean();
    if (!threat) throw new AppError(404, "Not found");

    const vuls = await Vulnerability.find({ key: { $in: threat.vulnerabilityKeys }, organizationId: { $in: [null, ctx.organizationId] } }).lean();
    const resolvedVulnerabilities = vuls.map(v => ({ key: v.key, name: v.name }));

    const controlKeys = new Set(vuls.flatMap(v => v.recommendedControlKeys));
    const ctls = await Control.find({ key: { $in: Array.from(controlKeys) }, organizationId: { $in: [null, ctx.organizationId] } }).lean();
    const resolvedControls = ctls.map(c => ({ key: c.key, name: c.name }));

    return {
      ...threat, _id: undefined, __v: undefined, organizationId: undefined, scope: threat.organizationId === null ? "global" : "custom",
      vulnerabilities: resolvedVulnerabilities,
      controls: resolvedControls
    };
  },

  async createThreat(ctx: { organizationId: string, actor: string }, input: any) {
    const vuls = await Vulnerability.find({ key: { $in: input.vulnerabilityKeys }, organizationId: { $in: [null, ctx.organizationId] } }).select("key").lean();
    if (vuls.length !== input.vulnerabilityKeys.length) {
      const found = new Set(vuls.map(v => v.key));
      const missing = input.vulnerabilityKeys.filter((k: string) => !found.has(k));
      throw new AppError(400, `Unknown keys: ${missing.join(", ")}`);
    }

    const key = generateKey("thr", input.name);
    const exists = await Threat.findOne({ key, organizationId: ctx.organizationId }).lean();
    if (exists) throw new AppError(409, "An entry with this name already exists");

    const doc = await Threat.create({ ...input, key, organizationId: ctx.organizationId });
    await logAudit("threat.create", ctx, { targetKey: key, after: doc });
    return this.getThreatDetail(ctx, key);
  },

  async updateThreat(ctx: { organizationId: string, actor: string }, key: string, input: any) {
    const existing = await Threat.findOne({ key, organizationId: { $in: [null, ctx.organizationId] } }).lean();
    if (!existing) throw new AppError(404, "Not found");
    if (existing.organizationId === null) throw new AppError(403, "Global library entries are read-only");

    const vuls = await Vulnerability.find({ key: { $in: input.vulnerabilityKeys }, organizationId: { $in: [null, ctx.organizationId] } }).select("key").lean();
    if (vuls.length !== input.vulnerabilityKeys.length) {
      const found = new Set(vuls.map(v => v.key));
      const missing = input.vulnerabilityKeys.filter((k: string) => !found.has(k));
      throw new AppError(400, `Unknown keys: ${missing.join(", ")}`);
    }

    if (input.name !== existing.name) {
       // Validate new name doesn't exist for another item? The prompt says "duplicate name -> 409", but wait, uniqueness is based on the key? "An entry with this name already exists". 
       const existingName = await Threat.findOne({ name: input.name, organizationId: ctx.organizationId, key: { $ne: key } }).lean();
       if (existingName) throw new AppError(409, "An entry with this name already exists");
    }

    const updated = await Threat.findOneAndUpdate({ key, organizationId: ctx.organizationId }, { $set: input }, { new: true }).lean();
    await logAudit("threat.update", ctx, { targetKey: key, before: existing, after: updated });
    return this.getThreatDetail(ctx, key);
  },

  async deleteThreat(ctx: { organizationId: string, actor: string }, key: string) {
    const existing = await Threat.findOne({ key, organizationId: { $in: [null, ctx.organizationId] } }).lean();
    if (!existing) throw new AppError(404, "Not found");
    if (existing.organizationId === null) throw new AppError(403, "Global library entries are read-only");

    const riskCount = await Risk.countDocuments({ threatId: key, organizationId: ctx.organizationId });
    if (riskCount > 0) throw new AppError(409, `Threat is used by ${riskCount} item(s) and cannot be deleted`);

    await Threat.deleteOne({ key, organizationId: ctx.organizationId });
    await logAudit("threat.delete", ctx, { targetKey: key, before: existing });
  },

  // VULNERABILITIES
  async listVulnerabilities(ctx: { organizationId: string }, query: any) {
    const filter: any = { organizationId: { $in: [null, ctx.organizationId] }, ...buildSearchQuery(query.q) };
    if (query.scope === "global") filter.organizationId = null;
    if (query.scope === "custom") filter.organizationId = ctx.organizationId;
    if (query.severity) filter.severity = query.severity;
    if (query.assetType) filter.applicableAssetTypes = query.assetType;
    if (query.threatKey) {
      const threats = await Threat.find({ key: query.threatKey, organizationId: { $in: [null, ctx.organizationId] } }).lean();
      if (!threats.length) return { items: [], total: 0, page: query.page, limit: query.limit };
      filter.key = { $in: threats[0].vulnerabilityKeys };
    }

    const skip = (query.page - 1) * query.limit;
    const items = await Vulnerability.find(filter).sort({ [query.sort || "name"]: query.order === "desc" ? -1 : 1 }).skip(skip).limit(query.limit).lean();
    const total = await Vulnerability.countDocuments(filter);

    return {
      items: items.map(v => ({ ...v, _id: undefined, __v: undefined, organizationId: undefined, scope: v.organizationId === null ? "global" : "custom" })),
      total, page: query.page, limit: query.limit
    };
  },

  async getVulnerabilityDetail(ctx: { organizationId: string }, key: string) {
    const vul = await Vulnerability.findOne({ key, organizationId: { $in: [null, ctx.organizationId] } }).lean();
    if (!vul) throw new AppError(404, "Not found");

    const ctls = await Control.find({ key: { $in: vul.recommendedControlKeys }, organizationId: { $in: [null, ctx.organizationId] } }).lean();
    const resolvedControls = ctls.map(c => ({ key: c.key, name: c.name }));

    const threats = await Threat.find({ vulnerabilityKeys: key, organizationId: { $in: [null, ctx.organizationId] } }).lean();
    const resolvedThreats = threats.map(t => ({ key: t.key, name: t.name }));

    return {
      ...vul, _id: undefined, __v: undefined, organizationId: undefined, scope: vul.organizationId === null ? "global" : "custom",
      controls: resolvedControls,
      threats: resolvedThreats
    };
  },

  async createVulnerability(ctx: { organizationId: string, actor: string }, input: any) {
    const ctls = await Control.find({ key: { $in: input.recommendedControlKeys }, organizationId: { $in: [null, ctx.organizationId] } }).select("key").lean();
    if (ctls.length !== input.recommendedControlKeys.length) {
      const found = new Set(ctls.map(c => c.key));
      const missing = input.recommendedControlKeys.filter((k: string) => !found.has(k));
      throw new AppError(400, `Unknown keys: ${missing.join(", ")}`);
    }

    const key = generateKey("vul", input.name);
    const exists = await Vulnerability.findOne({ key, organizationId: ctx.organizationId }).lean();
    if (exists) throw new AppError(409, "An entry with this name already exists");

    const doc = await Vulnerability.create({ ...input, key, organizationId: ctx.organizationId });
    await logAudit("vulnerability.create", ctx, { targetKey: key, after: doc });
    return this.getVulnerabilityDetail(ctx, key);
  },

  async updateVulnerability(ctx: { organizationId: string, actor: string }, key: string, input: any) {
    const existing = await Vulnerability.findOne({ key, organizationId: { $in: [null, ctx.organizationId] } }).lean();
    if (!existing) throw new AppError(404, "Not found");
    if (existing.organizationId === null) throw new AppError(403, "Global library entries are read-only");

    const ctls = await Control.find({ key: { $in: input.recommendedControlKeys }, organizationId: { $in: [null, ctx.organizationId] } }).select("key").lean();
    if (ctls.length !== input.recommendedControlKeys.length) {
      const found = new Set(ctls.map(c => c.key));
      const missing = input.recommendedControlKeys.filter((k: string) => !found.has(k));
      throw new AppError(400, `Unknown keys: ${missing.join(", ")}`);
    }

    if (input.name !== existing.name) {
       const existingName = await Vulnerability.findOne({ name: input.name, organizationId: ctx.organizationId, key: { $ne: key } }).lean();
       if (existingName) throw new AppError(409, "An entry with this name already exists");
    }

    const updated = await Vulnerability.findOneAndUpdate({ key, organizationId: ctx.organizationId }, { $set: input }, { new: true }).lean();
    await logAudit("vulnerability.update", ctx, { targetKey: key, before: existing, after: updated });
    return this.getVulnerabilityDetail(ctx, key);
  },

  async deleteVulnerability(ctx: { organizationId: string, actor: string }, key: string) {
    const existing = await Vulnerability.findOne({ key, organizationId: { $in: [null, ctx.organizationId] } }).lean();
    if (!existing) throw new AppError(404, "Not found");
    if (existing.organizationId === null) throw new AppError(403, "Global library entries are read-only");

    const riskCount = await Risk.countDocuments({ vulnerabilityId: key, organizationId: ctx.organizationId });
    const threatCount = await Threat.countDocuments({ vulnerabilityKeys: key, organizationId: { $in: [null, ctx.organizationId] } });
    const total = riskCount + threatCount;
    if (total > 0) throw new AppError(409, `Vulnerability is used by ${total} item(s) and cannot be deleted`);

    await Vulnerability.deleteOne({ key, organizationId: ctx.organizationId });
    await logAudit("vulnerability.delete", ctx, { targetKey: key, before: existing });
  },

  // CONTROLS
  async listControls(ctx: { organizationId: string }, query: any) {
    const filter: any = { organizationId: { $in: [null, ctx.organizationId] }, ...buildSearchQuery(query.q) };
    if (query.scope === "global") filter.organizationId = null;
    if (query.scope === "custom") filter.organizationId = ctx.organizationId;
    if (query.category) filter.category = query.category;
    if (query.reduces) filter.reduces = query.reduces;
    if (query.cost) filter.implementationCost = query.cost;
    if (query.vulnerabilityKey) {
      const vuls = await Vulnerability.find({ key: query.vulnerabilityKey, organizationId: { $in: [null, ctx.organizationId] } }).lean();
      if (!vuls.length) return { items: [], total: 0, page: query.page, limit: query.limit };
      filter.key = { $in: vuls[0].recommendedControlKeys };
    }

    const skip = (query.page - 1) * query.limit;
    const items = await Control.find(filter).sort({ [query.sort || "name"]: query.order === "desc" ? -1 : 1 }).skip(skip).limit(query.limit).lean();
    const total = await Control.countDocuments(filter);

    return {
      items: items.map(c => ({ ...c, _id: undefined, __v: undefined, organizationId: undefined, scope: c.organizationId === null ? "global" : "custom" })),
      total, page: query.page, limit: query.limit
    };
  },

  async getControlDetail(ctx: { organizationId: string }, key: string) {
    const ctl = await Control.findOne({ key, organizationId: { $in: [null, ctx.organizationId] } }).lean();
    if (!ctl) throw new AppError(404, "Not found");

    const vuls = await Vulnerability.find({ recommendedControlKeys: key, organizationId: { $in: [null, ctx.organizationId] } }).lean();
    const resolvedVulnerabilities = vuls.map(v => ({ key: v.key, name: v.name }));

    const threatKeys = new Set(vuls.flatMap(v => v.key));
    const threats = await Threat.find({ vulnerabilityKeys: { $in: Array.from(threatKeys) }, organizationId: { $in: [null, ctx.organizationId] } }).lean();
    const resolvedThreats = threats.map(t => ({ key: t.key, name: t.name }));

    return {
      ...ctl, _id: undefined, __v: undefined, organizationId: undefined, scope: ctl.organizationId === null ? "global" : "custom",
      vulnerabilities: resolvedVulnerabilities,
      threats: resolvedThreats
    };
  },

  async createControl(ctx: { organizationId: string, actor: string }, input: any) {
    const key = generateKey("ctl", input.name);
    const exists = await Control.findOne({ key, organizationId: ctx.organizationId }).lean();
    if (exists) throw new AppError(409, "An entry with this name already exists");

    const doc = await Control.create({ ...input, key, organizationId: ctx.organizationId });
    await logAudit("control.create", ctx, { targetKey: key, after: doc });
    return this.getControlDetail(ctx, key);
  },

  async updateControl(ctx: { organizationId: string, actor: string }, key: string, input: any) {
    const existing = await Control.findOne({ key, organizationId: { $in: [null, ctx.organizationId] } }).lean();
    if (!existing) throw new AppError(404, "Not found");
    if (existing.organizationId === null) throw new AppError(403, "Global library entries are read-only");

    if (input.name !== existing.name) {
       const existingName = await Control.findOne({ name: input.name, organizationId: ctx.organizationId, key: { $ne: key } }).lean();
       if (existingName) throw new AppError(409, "An entry with this name already exists");
    }

    const updated = await Control.findOneAndUpdate({ key, organizationId: ctx.organizationId }, { $set: input }, { new: true }).lean();
    await logAudit("control.update", ctx, { targetKey: key, before: existing, after: updated });
    return this.getControlDetail(ctx, key);
  },

  async deleteControl(ctx: { organizationId: string, actor: string }, key: string) {
    const existing = await Control.findOne({ key, organizationId: { $in: [null, ctx.organizationId] } }).lean();
    if (!existing) throw new AppError(404, "Not found");
    if (existing.organizationId === null) throw new AppError(403, "Global library entries are read-only");

    const riskCount = await Risk.countDocuments({ "controls.controlId": key, organizationId: ctx.organizationId });
    const vulCount = await Vulnerability.countDocuments({ recommendedControlKeys: key, organizationId: { $in: [null, ctx.organizationId] } });
    const total = riskCount + vulCount;
    if (total > 0) throw new AppError(409, `Control is used by ${total} item(s) and cannot be deleted`);

    await Control.deleteOne({ key, organizationId: ctx.organizationId });
    await logAudit("control.delete", ctx, { targetKey: key, before: existing });
  }
};
