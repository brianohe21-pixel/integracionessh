import type { Campaign, CampaignStatus } from "../../types/index.js";

export function resolvePreStartCampaignStatus(
  scheduledAt?: string | null
): Extract<CampaignStatus, "draft" | "scheduled"> {
  return scheduledAt ? "scheduled" : "draft";
}

export function canEditCampaign(status: CampaignStatus): boolean {
  return status === "draft" || status === "scheduled";
}

export function canArchiveCampaign(status: CampaignStatus): boolean {
  return status !== "running";
}

export function canRetryFailedRecipients(campaign: Pick<Campaign, "status" | "failed">): boolean {
  if (campaign.failed <= 0) return false;
  return (
    campaign.status === "completed" ||
    campaign.status === "paused" ||
    campaign.status === "failed" ||
    campaign.status === "cancelled"
  );
}

export function canCloneCampaign(status: CampaignStatus): boolean {
  return status !== "running" && status !== "paused";
}
