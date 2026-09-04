import { setCampaignNextBatchAt } from "../dynamodb/campaign.repository.js";
import { evaluateLaw2300ForTenant } from "./law2300-tenant.js";
import { getNextLaw2300WindowStart } from "./law2300.js";
import {
  createCampaignBatchSchedule,
  deleteCampaignBatchSchedule,
} from "../campaign/scheduler.js";

export async function deferCampaignDispatchForLaw2300(
  tenantId: string,
  campaignId: string,
  batchVersion = 1
): Promise<boolean> {
  const evaluation = await evaluateLaw2300ForTenant(tenantId);
  if (evaluation.allowed) return true;

  const nextAt = evaluation.nextWindowAt ?? new Date(Date.now() + 60_000);
  await deleteCampaignBatchSchedule(campaignId);
  await setCampaignNextBatchAt(tenantId, campaignId, nextAt.toISOString());
  await createCampaignBatchSchedule(campaignId, tenantId, nextAt, batchVersion);
  return false;
}

export async function resolveLaw2300AwareRunAt(
  tenantId: string,
  requestedAt: Date
): Promise<Date> {
  const evaluation = await evaluateLaw2300ForTenant(tenantId, requestedAt);
  if (evaluation.allowed) return requestedAt;
  return evaluation.nextWindowAt ?? getNextLaw2300WindowStart(requestedAt);
}
