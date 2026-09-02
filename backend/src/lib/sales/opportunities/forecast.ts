import type { Opportunity, PipelineStage } from "../../../types/index.js";

export function computeDaysInStage(stageEnteredAt?: string, fallbackAt?: string): number {
  const anchor = stageEnteredAt ?? fallbackAt;
  if (!anchor) return 0;
  const diff = Date.now() - new Date(anchor).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export function computeForecastAmount(
  opportunity: Opportunity,
  stage?: PipelineStage
): number {
  if (!opportunity.amount || opportunity.amount <= 0) return 0;
  const probability = stage?.probability ?? 0;
  return Math.round((opportunity.amount * probability) / 100);
}

export function enrichOpportunity(
  opportunity: Opportunity,
  stage?: PipelineStage
): Opportunity & { daysInStage: number; forecastAmount: number } {
  return {
    ...opportunity,
    daysInStage: computeDaysInStage(opportunity.stageEnteredAt, opportunity.createdAt),
    forecastAmount: computeForecastAmount(opportunity, stage),
  };
}
