import type { VoiceCampaign } from "../../types/index.js";

export function canStartCampaign(campaign: VoiceCampaign): boolean {
  return campaign.status === "draft" || campaign.status === "paused";
}

export function nextCampaignRecipient(campaign: VoiceCampaign): string | undefined {
  return campaign.recipients[campaign.nextIndex];
}
