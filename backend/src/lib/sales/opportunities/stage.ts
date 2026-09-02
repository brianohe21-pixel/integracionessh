import { randomUUID } from "crypto";
import {
  appendStageHistory,
  getOpportunityById,
  updateOpportunity,
} from "../../dynamodb/opportunity.repository.js";
import { cancelEnrollmentsForOpportunity } from "../../dynamodb/sequence-enrollment.repository.js";
import { findStageById, getPipelineById } from "../../dynamodb/pipeline.repository.js";
import type { Opportunity, OpportunityLossReason, OpportunityStage } from "../../../types/index.js";
import { recordOpportunityActivity } from "./activity.js";
import { triggerSequencesForOpportunity } from "../sequences/triggers.js";

export async function moveOpportunityStage(params: {
  tenantId: string;
  opportunityId: string;
  stageId: string;
  changedBy?: string;
  closeReason?: string;
  lossReason?: OpportunityLossReason;
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
    stageEnteredAt: now,
    lastActivityAt: now,
  };

  if (targetStage.isClosed) {
    updates.closedAt = now;
    if (params.closeReason) updates.closeReason = params.closeReason;
    if (params.lossReason) updates.lossReason = params.lossReason;
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

  await recordOpportunityActivity({
    tenantId: params.tenantId,
    opportunityId: params.opportunityId,
    type: targetStage.isClosed ? "closed" : "stage_changed",
    message: `${existing.stage} → ${targetStage.key}`,
    ...(params.changedBy ? { actorId: params.changedBy } : {}),
    metadata: {
      fromStageId: existing.stageId,
      toStageId: targetStage.stageId,
      ...(params.closeReason ? { closeReason: params.closeReason } : {}),
      ...(params.lossReason ? { lossReason: params.lossReason } : {}),
    },
    touchLastActivity: false,
  });

  if (!targetStage.isClosed) {
    await triggerSequencesForOpportunity({
      tenantId: params.tenantId,
      opportunityId: params.opportunityId,
      trigger: "stage_entered",
      stageId: targetStage.stageId,
      pipelineId: updated.pipelineId,
    });
  }

  return updated;
}
