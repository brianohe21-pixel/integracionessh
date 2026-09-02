import { listAllOpportunities } from "./opportunity.repository.js";
import { getPipelineById, sortStages } from "./pipeline.repository.js";
import type { SalesFunnelMetrics } from "../../types/index.js";

export async function getSalesFunnelMetrics(
  tenantId: string,
  pipelineId: string
): Promise<SalesFunnelMetrics | null> {
  const pipeline = await getPipelineById(tenantId, pipelineId);
  if (!pipeline) return null;

  const opportunities = await listAllOpportunities(tenantId, pipelineId);
  const stages = sortStages(pipeline.stages);

  const byStage = stages.map((stage) => {
    const stageOpportunities = opportunities.filter((opp) => opp.stageId === stage.stageId);
    const value = stageOpportunities.reduce((sum, opp) => sum + (opp.amount ?? 0), 0);
    return {
      stageId: stage.stageId,
      key: stage.key,
      label: stage.label,
      count: stageOpportunities.length,
      value,
      ...(stage.probability !== undefined ? { probability: stage.probability } : {}),
    };
  });

  const totalValue = opportunities.reduce((sum, opp) => sum + (opp.amount ?? 0), 0);
  const wonStage = stages.find((stage) => stage.outcome === "won");
  const wonOpportunities = wonStage
    ? opportunities.filter((opp) => opp.stageId === wonStage.stageId)
    : opportunities.filter((opp) => opp.stage === "won");
  const wonValue = wonOpportunities.reduce((sum, opp) => sum + (opp.amount ?? 0), 0);

  const closedCount = opportunities.filter((opp) => {
    const stage = stages.find((item) => item.stageId === opp.stageId);
    return stage?.isClosed;
  }).length;
  const conversionRate =
    closedCount > 0 ? Math.round((wonOpportunities.length / closedCount) * 1000) / 10 : 0;

  const forecastValue = byStage.reduce((sum, stage) => {
    const probability = stage.probability ?? 0;
    return sum + stage.value * (probability / 100);
  }, 0);

  const funnel = byStage.reduce<Record<string, number>>((acc, stage) => {
    acc[stage.key] = stage.count;
    return acc;
  }, {});

  return {
    pipelineId,
    total: opportunities.length,
    totalValue,
    wonValue,
    forecastValue: Math.round(forecastValue * 100) / 100,
    conversionRate,
    byStage,
    funnel,
  };
}
