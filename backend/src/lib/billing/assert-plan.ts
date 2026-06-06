import { listBots } from "../dynamodb/bot.repository.js";
import { listCampaigns } from "../dynamodb/campaign.repository.js";
import {
  countAutomationsForBot,
  countScheduledAutomations,
} from "../dynamodb/automation.repository.js";
import { countDocumentsForBot, getTotalStorageBytesForBot } from "../dynamodb/knowledge.repository.js";
import { getMonthlyUsage } from "../dynamodb/usage.repository.js";
import type { Tenant } from "../../types/index.js";
import {
  getPlanLimits,
  isUnlimited,
  PlanLimitError,
  assertSubscriptionAllowsSending,
} from "./plan-limits.js";

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
