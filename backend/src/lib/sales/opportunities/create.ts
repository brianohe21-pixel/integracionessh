import { randomUUID } from "crypto";
import {
  appendStageHistory,
  createOpportunity,
  type OpportunityUpdateInput,
} from "../../dynamodb/opportunity.repository.js";
import {
  linkCompanyOpportunity,
  unlinkCompanyOpportunity,
} from "../../dynamodb/company.repository.js";
import type { Opportunity } from "../../../types/index.js";
import { recordOpportunityActivity } from "./activity.js";
import { triggerSequencesForOpportunity } from "../sequences/triggers.js";

export async function persistNewOpportunity(opportunity: Opportunity): Promise<Opportunity> {
  const withTimestamps: Opportunity = {
    ...opportunity,
    stageEnteredAt: opportunity.stageEnteredAt ?? opportunity.createdAt,
    lastActivityAt: opportunity.lastActivityAt ?? opportunity.createdAt,
  };

  await createOpportunity(withTimestamps);

  await appendStageHistory({
    historyId: randomUUID(),
    opportunityId: withTimestamps.opportunityId,
    tenantId: withTimestamps.tenantId,
    toStageId: withTimestamps.stageId,
    toStageKey: withTimestamps.stage,
    changedAt: withTimestamps.createdAt,
  });

  await recordOpportunityActivity({
    tenantId: withTimestamps.tenantId,
    opportunityId: withTimestamps.opportunityId,
    type: "created",
    message: withTimestamps.title,
    touchLastActivity: false,
  });

  if (withTimestamps.companyId) {
    await linkCompanyOpportunity(
      withTimestamps.tenantId,
      withTimestamps.companyId,
      withTimestamps.opportunityId
    );
  }

  await triggerSequencesForOpportunity({
    tenantId: withTimestamps.tenantId,
    opportunityId: withTimestamps.opportunityId,
    trigger: "opportunity_created",
    pipelineId: withTimestamps.pipelineId,
  });

  return withTimestamps;
}

export async function syncCompanyLink(
  tenantId: string,
  opportunityId: string,
  previousCompanyId?: string,
  nextCompanyId?: string
): Promise<void> {
  if (previousCompanyId && previousCompanyId !== nextCompanyId) {
    await unlinkCompanyOpportunity(tenantId, previousCompanyId, opportunityId);
  }
  if (nextCompanyId) {
    await linkCompanyOpportunity(tenantId, nextCompanyId, opportunityId);
  }
}

export async function applyOpportunityPatch(
  tenantId: string,
  opportunityId: string,
  existing: Opportunity,
  patch: OpportunityUpdateInput,
  actorId?: string
): Promise<Opportunity | null> {
  const { updateOpportunity } = await import("../../dynamodb/opportunity.repository.js");

  if (patch.companyId !== undefined && patch.companyId !== existing.companyId) {
    await syncCompanyLink(tenantId, opportunityId, existing.companyId, patch.companyId);
  }

  const now = new Date().toISOString();
  const mergedPatch: OpportunityUpdateInput = {
    ...patch,
    lastActivityAt: now,
  };

  const updated = await updateOpportunity(tenantId, opportunityId, mergedPatch);
  if (!updated) return null;

  if (patch.assignedAdvisorId && patch.assignedAdvisorId !== existing.assignedAdvisorId) {
    await recordOpportunityActivity({
      tenantId,
      opportunityId,
      type: "assigned",
      message: patch.assignedAdvisorId,
      ...(actorId ? { actorId } : {}),
      touchLastActivity: false,
    });
  }

  if (patch.description !== undefined && patch.description !== existing.description) {
    await recordOpportunityActivity({
      tenantId,
      opportunityId,
      type: "note_updated",
      ...(actorId ? { actorId } : {}),
      touchLastActivity: false,
    });
  }

  return updated;
}
