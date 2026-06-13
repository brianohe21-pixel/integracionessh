import { listBots } from "../dynamodb/bot.repository.js";
import { listCampaigns } from "../dynamodb/campaign.repository.js";
import {
  countAutomationsForBot,
  countScheduledAutomations,
} from "../dynamodb/automation.repository.js";
import { countDocumentsForBot, getTotalStorageBytesForBot } from "../dynamodb/knowledge.repository.js";
import { countMetaFlowsForBot } from "../dynamodb/meta-flow.repository.js";
import {
  countActiveFlowRuns,
  countFlowsForBot,
} from "../dynamodb/flow.repository.js";
import { getMonthlyUsage } from "../dynamodb/usage.repository.js";
import { countActiveLiveKitCallsForTenant } from "../dynamodb/livekit-call.repository.js";
import type { Tenant, Channel } from "../../types/index.js";
import {
  getPlanLimits,
  isUnlimited,
  PlanLimitError,
  assertSubscriptionAllowsSending,
} from "./plan-limits.js";
import { assertCanEnableKnowledge } from "./plan-config.js";

export async function assertCanCreateBot(tenant: Tenant): Promise<void> {
  const limits = getPlanLimits(tenant.plan);
  if (isUnlimited(limits.maxActiveBots)) return;

  const bots = await listBots(tenant.tenantId);
  const active = bots.filter((b) => b.status === "active").length;
  if (active >= limits.maxActiveBots) {
    throw new PlanLimitError(
      "PLAN_LIMIT_BOTS",
      `Plan limit reached: maximum ${limits.maxActiveBots} active bot(s)`
    );
  }
}

export async function assertCanSendMessages(
  tenant: Tenant,
  additionalMessages = 1
): Promise<void> {
  assertSubscriptionAllowsSending(tenant);
  const limits = getPlanLimits(tenant.plan);
  const usage = await getMonthlyUsage(tenant.tenantId);
  if (usage.messagesCount + additionalMessages > limits.maxMessagesPerMonth) {
    throw new PlanLimitError(
      "PLAN_LIMIT_MESSAGES",
      `Monthly message limit reached (${limits.maxMessagesPerMonth})`
    );
  }
}

export async function assertBulkRecipients(tenant: Tenant, count: number): Promise<void> {
  assertSubscriptionAllowsSending(tenant);
  const limits = getPlanLimits(tenant.plan);
  if (count > limits.maxBulkRecipientsPerJob) {
    throw new PlanLimitError(
      "PLAN_LIMIT_BULK",
      `Plan limit: maximum ${limits.maxBulkRecipientsPerJob} recipients per job`
    );
  }
  const usage = await getMonthlyUsage(tenant.tenantId);
  if (usage.bulkRecipientsCount + count > limits.maxMessagesPerMonth * 10) {
    throw new PlanLimitError("PLAN_LIMIT_BULK", "Monthly bulk send quota exceeded");
  }
}

export async function assertCanAddContacts(tenant: Tenant, totalAfter: number): Promise<void> {
  const limits = getPlanLimits(tenant.plan);
  if (isUnlimited(limits.maxContacts)) return;
  if (totalAfter > limits.maxContacts) {
    throw new PlanLimitError(
      "PLAN_LIMIT_CONTACTS",
      `Plan limit: maximum ${limits.maxContacts} contacts`
    );
  }
}

export async function assertCanCreateAutomation(tenant: Tenant, botId: string): Promise<void> {
  const limits = getPlanLimits(tenant.plan);
  if (isUnlimited(limits.maxAutomationsPerBot)) return;

  const count = await countAutomationsForBot(tenant.tenantId, botId);
  if (count >= limits.maxAutomationsPerBot) {
    throw new PlanLimitError(
      "PLAN_LIMIT_AUTOMATIONS",
      `Plan limit: maximum ${limits.maxAutomationsPerBot} automation(s) per bot`
    );
  }
}

export async function assertCanEnableScheduledAutomation(tenant: Tenant): Promise<void> {
  const limits = getPlanLimits(tenant.plan);
  if (isUnlimited(limits.maxScheduledAutomations)) return;

  const count = await countScheduledAutomations(tenant.tenantId);
  if (count >= limits.maxScheduledAutomations) {
    throw new PlanLimitError(
      "PLAN_LIMIT_SCHEDULED_AUTOMATIONS",
      `Plan limit: maximum ${limits.maxScheduledAutomations} scheduled automation(s)`
    );
  }
}

export async function assertCanAddKnowledgeDocument(
  tenant: Tenant,
  botId: string,
  additionalBytes: number
): Promise<void> {
  assertCanEnableKnowledge(tenant);
  const limits = getPlanLimits(tenant.plan);
  const docCount = await countDocumentsForBot(tenant.tenantId, botId);
  if (docCount >= limits.maxDocumentsPerBot) {
    throw new PlanLimitError(
      "PLAN_LIMIT_KNOWLEDGE_DOCS",
      `Plan limit: maximum ${limits.maxDocumentsPerBot} document(s) per bot`
    );
  }

  const currentBytes = await getTotalStorageBytesForBot(tenant.tenantId, botId);
  const maxBytes = limits.maxKnowledgeStorageMb * 1024 * 1024;
  if (currentBytes + additionalBytes > maxBytes) {
    throw new PlanLimitError(
      "PLAN_LIMIT_KNOWLEDGE_STORAGE",
      `Plan limit: maximum ${limits.maxKnowledgeStorageMb} MB knowledge storage per bot`
    );
  }
}

export async function assertCanCreateMetaFlow(tenant: Tenant, botId: string): Promise<void> {
  const limits = getPlanLimits(tenant.plan);
  if (isUnlimited(limits.maxMetaFlowsPerBot)) return;

  const count = await countMetaFlowsForBot(tenant.tenantId, botId);
  if (count >= limits.maxMetaFlowsPerBot) {
    throw new PlanLimitError(
      "PLAN_LIMIT_META_FLOWS",
      `Plan limit: maximum ${limits.maxMetaFlowsPerBot} Meta flow(s) per bot`
    );
  }
}

export async function assertCanCreateVisualFlow(
  tenant: Tenant,
  botId: string,
  nodeCount: number
): Promise<void> {
  const limits = getPlanLimits(tenant.plan);
  if (nodeCount > limits.maxFlowNodes) {
    throw new PlanLimitError(
      "PLAN_LIMIT_FLOW_NODES",
      `Plan limit: maximum ${limits.maxFlowNodes} nodes per flow`
    );
  }
  if (isUnlimited(limits.maxVisualFlowsPerBot)) return;

  const count = await countFlowsForBot(tenant.tenantId, botId);
  if (count >= limits.maxVisualFlowsPerBot) {
    throw new PlanLimitError(
      "PLAN_LIMIT_VISUAL_FLOWS",
      `Plan limit: maximum ${limits.maxVisualFlowsPerBot} visual flow(s) per bot`
    );
  }
}

export async function assertCanEnableVisualFlow(tenant: Tenant): Promise<void> {
  const limits = getPlanLimits(tenant.plan);
  if (isUnlimited(limits.maxActiveFlowRuns)) return;

  const count = await countActiveFlowRuns(tenant.tenantId);
  if (count >= limits.maxActiveFlowRuns) {
    throw new PlanLimitError(
      "PLAN_LIMIT_ACTIVE_FLOW_RUNS",
      `Plan limit: maximum ${limits.maxActiveFlowRuns} active flow run(s)`
    );
  }
}

export async function assertCanStartCampaign(tenant: Tenant): Promise<void> {
  assertSubscriptionAllowsSending(tenant);
  const limits = getPlanLimits(tenant.plan);
  if (isUnlimited(limits.maxActiveCampaigns)) return;

  const campaigns = await listCampaigns(tenant.tenantId);
  const active = campaigns.filter((c) =>
    ["running", "scheduled", "paused"].includes(c.status)
  ).length;
  if (active >= limits.maxActiveCampaigns) {
    throw new PlanLimitError(
      "PLAN_LIMIT_CAMPAIGNS",
      `Plan limit: maximum ${limits.maxActiveCampaigns} active campaign(s)`
    );
  }
}

export async function assertCanStartLiveKitCall(tenant: Tenant): Promise<void> {
  const limits = getPlanLimits(tenant.plan);
  if (limits.maxConcurrentLiveKitCalls <= 0) {
    throw new PlanLimitError(
      "PLAN_LIMIT_LIVEKIT",
      "Voice calls require Pro plan or higher"
    );
  }

  const active = await countActiveLiveKitCallsForTenant(tenant.tenantId);
  if (active >= limits.maxConcurrentLiveKitCalls) {
    throw new PlanLimitError(
      "PLAN_LIMIT_LIVEKIT_CONCURRENT",
      `Plan limit: maximum ${limits.maxConcurrentLiveKitCalls} concurrent call(s)`
    );
  }
}

export async function assertCanUseWebChat(tenant: Tenant): Promise<void> {
  const limits = getPlanLimits(tenant.plan);
  if (limits.maxActiveWebChatSessions <= 0) {
    throw new PlanLimitError(
      "PLAN_LIMIT_WEBCHAT",
      "Web chat requires Pro plan or higher"
    );
  }
}

export async function assertCanEnableChannel(
  tenant: Tenant,
  bot: import("../../types/index.js").Bot,
  channel: Channel
): Promise<void> {
  if (channel === "whatsapp") return;

  const limits = getPlanLimits(tenant.plan);
  if (tenant.plan === "free") {
    throw new PlanLimitError(
      "PLAN_LIMIT_CHANNEL",
      "Additional channels require Pro plan or higher"
    );
  }

  let enabled = 1;
  if (bot.instagramPageId) enabled += 1;
  if (bot.webchatEnabled) enabled += 1;
  if (channel === "instagram" && !bot.instagramPageId) enabled += 1;
  if (channel === "webchat" && !bot.webchatEnabled) enabled += 1;

  if (enabled > limits.maxChannelsPerBot) {
    throw new PlanLimitError(
      "PLAN_LIMIT_CHANNELS",
      `Plan limit: maximum ${limits.maxChannelsPerBot} channel(s) per bot`
    );
  }
}
