import { getCampaign, listCampaignRecipients } from "./campaign.repository.js";
import { getConversation } from "./conversation.repository.js";
import { listAllLeads } from "./lead.repository.js";
import type { CampaignMetrics, Channel, Conversation } from "../../types/index.js";

function rate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function emptyConversionsByChannel(): Record<Channel, number> {
  return { whatsapp: 0, instagram: 0, webchat: 0 };
}

export async function getCampaignMetrics(
  tenantId: string,
  campaignId: string
): Promise<CampaignMetrics | null> {
  const campaign = await getCampaign(tenantId, campaignId);
  if (!campaign) return null;

  const repliedRecipients = await listCampaignRecipients(tenantId, campaignId, "replied");
  const conversationIds = new Set(
    repliedRecipients
      .map((r) => r.conversationId)
      .filter((id): id is string => Boolean(id))
  );

  const conversations = new Map<string, Conversation>();
  await Promise.all(
    [...conversationIds].map(async (conversationId) => {
      const conversation = await getConversation(tenantId, campaign.botId, conversationId);
      if (conversation) conversations.set(conversationId, conversation);
    })
  );

  let handoff = 0;
  let advisorResponded = 0;
  let pendingWaitCount = 0;
  let totalWaitTimeSeconds = 0;
  let waitSamples = 0;

  for (const conversation of conversations.values()) {
    if ((conversation.handoffMode ?? "bot") !== "human" || !conversation.handoffAt) continue;
    handoff++;
    if (conversation.firstHumanResponseAt) {
      advisorResponded++;
      const waitMs =
        new Date(conversation.firstHumanResponseAt).getTime() -
        new Date(conversation.handoffAt).getTime();
      if (waitMs >= 0) {
        totalWaitTimeSeconds += waitMs / 1000;
        waitSamples++;
      }
    } else {
      pendingWaitCount++;
    }
  }

  const leads = await listAllLeads(tenantId);
  const convertedLeads = leads.filter(
    (lead) => lead.status === "converted" && conversationIds.has(lead.conversationId)
  );

  const conversionsByChannel = emptyConversionsByChannel();
  for (const lead of convertedLeads) {
    const conversation = conversations.get(lead.conversationId);
    const channel = conversation?.channel ?? "whatsapp";
    conversionsByChannel[channel] = (conversionsByChannel[channel] ?? 0) + 1;
  }

  const replyCount = campaign.replyCount ?? repliedRecipients.length;
  const sent = campaign.sent;

  return {
    campaignId,
    updatedAt: new Date().toISOString(),
    replyRate: rate(replyCount, sent),
    advisorResponseRate: rate(advisorResponded, handoff),
    averageWaitTimeSeconds:
      waitSamples > 0 ? Math.round(totalWaitTimeSeconds / waitSamples) : 0,
    pendingWaitCount,
    conversionsByChannel,
    funnel: {
      sent,
      replied: replyCount,
      handoff,
      advisorResponded,
      converted: convertedLeads.length,
    },
  };
}
