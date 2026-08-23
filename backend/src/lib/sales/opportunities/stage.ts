import { randomUUID } from "crypto";
import {
  appendStageHistory,
  getOpportunityById,
  updateOpportunity,
} from "../../dynamodb/opportunity.repository.js";
import { cancelEnrollmentsForOpportunity } from "../../dynamodb/sequence-enrollment.repository.js";
import { findStageById, getPipelineById } from "../../dynamodb/pipeline.repository.js";
import type { Opportunity, OpportunityStage } from "../../../types/index.js";

export async function moveOpportunityStage(params: {
  tenantId: string;
  opportunityId: string;
  stageId: string;
  changedBy?: string;
  closeReason?: string;
}): Promise<Opportunity | null> {
  const existing = await getOpportunityById(params.tenantId, params.opportunityId);
  if (!existing) return null;

  const pipeline = await getPipelineById(params.tenantId, existing.pipelineId);
  if (!pipeline) return null;

  const targetStage = findStageById(pipeline, params.stageId);
  if (!targetStage) return null;

  const now = new Date().toISOString();
  const updates: Parameters<typeof updateOpportunity>[2] = {
    stageId: targetStage.stageId,
    stage: targetStage.key as OpportunityStage,
  };

  if (targetStage.isClosed) {
    updates.closedAt = now;
    if (params.closeReason) updates.closeReason = params.closeReason;
    await cancelEnrollmentsForOpportunity(params.tenantId, params.opportunityId);
  }

  const updated = await updateOpportunity(params.tenantId, params.opportunityId, updates);
  if (!updated) return null;

  await appendStageHistory({
    historyId: randomUUID(),
    opportunityId: params.opportunityId,
    tenantId: params.tenantId,
    fromStageId: existing.stageId,
    toStageId: targetStage.stageId,
    fromStageKey: existing.stage,
    toStageKey: targetStage.key,
    ...(params.changedBy ? { changedBy: params.changedBy } : {}),
    changedAt: now,
  });

  return updated;
}
