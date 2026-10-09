import { Threat } from "@/models/Threat";
import { Vulnerability } from "@/models/Vulnerability";
import { Control } from "@/models/Control";
import { recommendControls, cascadeThreats, cascadeVulnerabilities, RecommendationError, LibraryView } from "@/lib/recommendations";
import { AppError } from "@/lib/errors";
import { AssetType } from "@/data/types";

async function getLibraryView(ctx: { organizationId: string }): Promise<LibraryView> {
  const [threats, vulnerabilities, controls] = await Promise.all([
    Threat.find({ organizationId: { $in: [null, ctx.organizationId] } }).lean(),
    Vulnerability.find({ organizationId: { $in: [null, ctx.organizationId] } }).lean(),
    Control.find({ organizationId: { $in: [null, ctx.organizationId] } }).lean(),
  ]);
  
  return {
    threats: threats as any,
    vulnerabilities: vulnerabilities as any,
    controls: controls as any
  };
}

export const recommendationService = {
  async getCascade(ctx: { organizationId: string }, input: { assetType: AssetType; threatKey?: string }) {
    const view = await getLibraryView(ctx);
    if (!input.threatKey) {
      return cascadeThreats(view, { assetType: input.assetType });
    } else {
      return cascadeVulnerabilities(view, { assetType: input.assetType, threatKey: input.threatKey });
    }
  },

  async getRecommendations(ctx: { organizationId: string }, input: any) {
    const view = await getLibraryView(ctx);
    try {
      return recommendControls(view, input);
    } catch (e: any) {
      if (e instanceof RecommendationError) {
        throw new AppError(400, e.code);
      }
      throw e;
    }
  }
};
