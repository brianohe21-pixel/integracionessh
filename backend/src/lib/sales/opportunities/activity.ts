import { appendOpportunityActivity } from "../../dynamodb/opportunity-activity.repository.js";
import { updateOpportunity } from "../../dynamodb/opportunity.repository.js";
import type { OpportunityActivityType } from "../../../types/index.js";

export async function recordOpportunityActivity(params: {
  tenantId: string;
  opportunityId: string;
  type: OpportunityActivityType;
  message?: string;
  actorId?: string;
  metadata?: Record<string, unknown>;
  touchLastActivity?: boolean;
}): Promise<void> {
  const now = new Date().toISOString();
  await appendOpportunityActivity({
    tenantId: params.tenantId,
    opportunityId: params.opportunityId,
    type: params.type,
    ...(params.message ? { message: params.message } : {}),
    ...(params.actorId ? { actorId: params.actorId } : {}),
    ...(params.metadata ? { metadata: params.metadata } : {}),
  });

  if (params.touchLastActivity) {
    await updateOpportunity(params.tenantId, params.opportunityId, { lastActivityAt: now });
  }
}
