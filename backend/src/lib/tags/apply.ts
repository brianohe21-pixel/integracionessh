import { randomUUID } from "crypto";
import {
  getContactByPhone,
  normalizePhone,
  updateContact,
} from "../dynamodb/contact.repository.js";
import { getTagByName, normalizeTagName } from "../dynamodb/tag.repository.js";
import {
  getOpportunityById,
  listAllOpportunities,
} from "../dynamodb/opportunity.repository.js";
import { getPipelineById, findStageById } from "../dynamodb/pipeline.repository.js";
import { getAdvisor } from "../dynamodb/advisor.repository.js";
import { getSequenceById } from "../dynamodb/sequence.repository.js";
import { createSalesTask } from "../dynamodb/sales-task.repository.js";
import { listConversations, getConversation } from "../dynamodb/conversation.repository.js";
import { getActiveLeadByPhone } from "../dynamodb/lead.repository.js";
import { listBots } from "../dynamodb/bot.repository.js";
import { moveOpportunityStage } from "../sales/opportunities/stage.js";
import { applyOpportunityPatch } from "../sales/opportunities/create.js";
import { enrollOpportunityInSequence } from "../sales/sequences/enroll.js";
import { performHandoff } from "../advisor/handoff.js";
import { applyMarketingConsent } from "../compliance/contact-consent.js";
import { createLeadFromFormData } from "../leads/form-lead.js";
import type {
  Contact,
  Opportunity,
  SalesTask,
  TagAction,
  TagDefinition,
} from "../../types/index.js";

function newlyAddedTags(previous: string[], next: string[]): string[] {
  const existing = new Set(previous.map(normalizeTagName));
  const added: string[] = [];
  const seen = new Set<string>();
  for (const tag of next) {
    const key = normalizeTagName(tag);
    if (!key || existing.has(key) || seen.has(key)) continue;
    seen.add(key);
    added.push(tag);
  }
  return added;
}

async function resolveDefinitions(
  tenantId: string,
  tagNames: string[]
): Promise<TagDefinition[]> {
  if (!tagNames.length) return [];

  const definitions: TagDefinition[] = [];
  const seen = new Set<string>();

  for (const name of tagNames) {
    const key = normalizeTagName(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const def = await getTagByName(tenantId, name);
    if (def) definitions.push(def);
  }

  return definitions;
}

async function findOpenOpportunities(params: {
  tenantId: string;
  phone?: string;
  opportunityId?: string;
  pipelineId?: string;
}): Promise<Opportunity[]> {
  if (params.opportunityId) {
    const match = await getOpportunityById(params.tenantId, params.opportunityId);
    if (!match || match.closedAt) return [];
    if (params.pipelineId && match.pipelineId !== params.pipelineId) return [];
    return [match];
  }

  if (!params.phone) return [];

  const phone = normalizePhone(params.phone);
  const all = await listAllOpportunities(params.tenantId, params.pipelineId);
  return all.filter((item) => {
    if (item.closedAt) return false;
    if (!item.phone) return false;
    return normalizePhone(item.phone) === phone;
  });
}

async function resolveConversation(params: {
  tenantId: string;
  phone?: string;
  opportunityId?: string;
}): Promise<{ botId: string; conversationId: string } | null> {
  if (params.opportunityId) {
    const opportunity = await getOpportunityById(params.tenantId, params.opportunityId);
    if (opportunity?.conversationId && opportunity.botId) {
      return { botId: opportunity.botId, conversationId: opportunity.conversationId };
    }
  }

  if (!params.phone) return null;
  const phone = normalizePhone(params.phone);

  const lead = await getActiveLeadByPhone(params.tenantId, phone);
  if (lead?.conversationId && lead.botId) {
    const conversation = await getConversation(params.tenantId, lead.botId, lead.conversationId);
    if (conversation) {
      return { botId: lead.botId, conversationId: lead.conversationId };
    }
  }

  const contact = await getContactByPhone(params.tenantId, phone);
  const botId = contact?.lastBotId;
  if (botId) {
    const list = await listConversations(params.tenantId, { botId, limit: 50 });
    const match = list.items.find(
      (item) => item.phoneNumber && normalizePhone(item.phoneNumber) === phone
    );
    if (match) return { botId, conversationId: match.conversationId };
  }

  return null;
}

async function resolveBotId(params: {
  tenantId: string;
  phone?: string;
  preferredBotId?: string;
}): Promise<string | null> {
  if (params.preferredBotId) return params.preferredBotId;
  if (params.phone) {
    const contact = await getContactByPhone(params.tenantId, normalizePhone(params.phone));
    if (contact?.lastBotId) return contact.lastBotId;
    const lead = await getActiveLeadByPhone(params.tenantId, normalizePhone(params.phone));
    if (lead?.botId) return lead.botId;
  }
  const bots = await listBots(params.tenantId);
  return bots[0]?.botId ?? null;
}

async function runTagAction(params: {
  tenantId: string;
  action: TagAction;
  phone?: string;
  opportunityId?: string;
  changedBy?: string;
  visited: Set<string>;
}): Promise<void> {
  const { action, tenantId } = params;

  switch (action.type) {
    case "move_opportunity_stage": {
      const pipeline = await getPipelineById(tenantId, action.pipelineId);
      if (!pipeline) return;
      const stage = findStageById(pipeline, action.stageId);
      if (!stage) return;

      const openOnly = action.openOnly !== false;
      const targets = await findOpenOpportunities({
        tenantId,
        pipelineId: action.pipelineId,
        ...(params.phone ? { phone: params.phone } : {}),
        ...(params.opportunityId ? { opportunityId: params.opportunityId } : {}),
      });
      const filtered = openOnly ? targets : targets;

      for (const opportunity of filtered) {
        if (opportunity.stageId === action.stageId) continue;
        if (!openOnly && opportunity.closedAt) continue;
        await moveOpportunityStage({
          tenantId,
          opportunityId: opportunity.opportunityId,
          stageId: action.stageId,
          ...(params.changedBy ? { changedBy: params.changedBy } : {}),
        });
      }
      return;
    }

    case "assign_advisor": {
      const advisor = await getAdvisor(tenantId, action.advisorId);
      if (!advisor || advisor.status !== "active") return;

      const opportunities = await findOpenOpportunities({
        tenantId,
        ...(params.phone ? { phone: params.phone } : {}),
        ...(params.opportunityId ? { opportunityId: params.opportunityId } : {}),
      });

      for (const opportunity of opportunities) {
        if (opportunity.assignedAdvisorId === action.advisorId) continue;
        await applyOpportunityPatch(
          tenantId,
          opportunity.opportunityId,
          opportunity,
          { assignedAdvisorId: action.advisorId },
          params.changedBy
        );
      }
      return;
    }

    case "handoff": {
      const conversation = await resolveConversation({
        tenantId,
        ...(params.phone ? { phone: params.phone } : {}),
        ...(params.opportunityId ? { opportunityId: params.opportunityId } : {}),
      });
      if (!conversation) return;

      if (action.advisorId) {
        const advisor = await getAdvisor(tenantId, action.advisorId);
        if (!advisor || advisor.status !== "active") return;
      }

      await performHandoff({
        tenantId,
        botId: conversation.botId,
        conversationId: conversation.conversationId,
        reason: "manual",
        ...(action.advisorId ? { advisorId: action.advisorId } : {}),
      });
      return;
    }

    case "enroll_sequence": {
      const sequence = await getSequenceById(tenantId, action.sequenceId);
      if (!sequence || !sequence.enabled) return;

      const opportunities = await findOpenOpportunities({
        tenantId,
        ...(params.phone ? { phone: params.phone } : {}),
        ...(params.opportunityId ? { opportunityId: params.opportunityId } : {}),
      });

      for (const opportunity of opportunities) {
        await enrollOpportunityInSequence({
          tenantId,
          sequenceId: action.sequenceId,
          opportunityId: opportunity.opportunityId,
          ...(opportunity.botId ? { botId: opportunity.botId } : {}),
          ...(opportunity.assignedAdvisorId
            ? { assignedAdvisorId: opportunity.assignedAdvisorId }
            : {}),
        });
      }
      return;
    }

    case "create_task": {
      const opportunities = await findOpenOpportunities({
        tenantId,
        ...(params.phone ? { phone: params.phone } : {}),
        ...(params.opportunityId ? { opportunityId: params.opportunityId } : {}),
      });
      const opportunity = opportunities[0];
      const contact = params.phone
        ? await getContactByPhone(tenantId, normalizePhone(params.phone))
        : null;
      const conversation = await resolveConversation({
        tenantId,
        ...(params.phone ? { phone: params.phone } : {}),
        ...(params.opportunityId ? { opportunityId: params.opportunityId } : {}),
      });

      const now = new Date();
      const dueAt =
        action.dueInHours && action.dueInHours > 0
          ? new Date(now.getTime() + action.dueInHours * 60 * 60 * 1000).toISOString()
          : undefined;

      const task: SalesTask = {
        taskId: randomUUID(),
        tenantId,
        title: action.title.trim(),
        status: "open",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        ...(action.description ? { description: action.description } : {}),
        ...(dueAt ? { dueAt } : {}),
        ...(action.advisorId
          ? { advisorId: action.advisorId }
          : opportunity?.assignedAdvisorId
            ? { advisorId: opportunity.assignedAdvisorId }
            : {}),
        ...(action.priority ? { priority: action.priority } : {}),
        ...(opportunity ? { opportunityId: opportunity.opportunityId } : {}),
        ...(conversation
          ? { conversationId: conversation.conversationId, botId: conversation.botId }
          : {}),
        ...(params.phone ? { contactPhone: normalizePhone(params.phone) } : {}),
        ...(contact?.displayName ? { contactName: contact.displayName } : {}),
        ...(contact?.email ? { contactEmail: contact.email } : {}),
      };

      await createSalesTask(task);
      return;
    }

    case "set_consent": {
      if (!params.phone) return;
      await applyMarketingConsent({
        tenantId,
        phone: params.phone,
        marketingConsent: action.marketingConsent,
        consentSource: "panel",
      });
      return;
    }

    case "apply_tags": {
      if (!params.phone || !action.tags.length) return;
      const phone = normalizePhone(params.phone);
      const existing = await getContactByPhone(tenantId, phone);
      if (!existing) return;

      const mergedTags = [...new Set([...existing.tags, ...action.tags])];
      const added = newlyAddedTags(existing.tags, mergedTags).filter(
        (tag) => !params.visited.has(normalizeTagName(tag))
      );
      if (!added.length) return;

      await updateContact(tenantId, phone, { tags: mergedTags });
      await runTagActionsForNames({
        tenantId,
        tagNames: added,
        phone,
        visited: params.visited,
        ...(params.opportunityId ? { opportunityId: params.opportunityId } : {}),
        ...(params.changedBy ? { changedBy: params.changedBy } : {}),
      });
      return;
    }

    case "create_lead": {
      if (!params.phone) return;
      const botId = await resolveBotId({
        tenantId,
        phone: params.phone,
        ...(action.botId ? { preferredBotId: action.botId } : {}),
      });
      if (!botId) return;

      const contact = await getContactByPhone(tenantId, normalizePhone(params.phone));
      await createLeadFromFormData({
        tenantId,
        botId,
        phone: params.phone,
        tags: action.tags?.length ? action.tags : ["lead"],
        ...(contact?.displayName ? { name: contact.displayName } : {}),
        ...(contact?.email ? { email: contact.email } : {}),
      });
      return;
    }
  }
}

export async function runTagActionsForNames(params: {
  tenantId: string;
  tagNames: string[];
  phone?: string;
  opportunityId?: string;
  changedBy?: string;
  visited?: Set<string>;
}): Promise<void> {
  const visited = params.visited ?? new Set<string>();
  const definitions = await resolveDefinitions(params.tenantId, params.tagNames);

  for (const definition of definitions) {
    const key = normalizeTagName(definition.name);
    if (!key || visited.has(key)) continue;
    visited.add(key);

    if (!definition.onApply?.length) continue;
    const changedBy = params.changedBy ?? `tag:${definition.name}`;

    for (const action of definition.onApply) {
      try {
        await runTagAction({
          tenantId: params.tenantId,
          action,
          changedBy,
          visited,
          ...(params.phone ? { phone: params.phone } : {}),
          ...(params.opportunityId ? { opportunityId: params.opportunityId } : {}),
        });
      } catch (error) {
        console.error(
          `Failed to run tag action ${action.type} for tag ${definition.name}:`,
          error
        );
      }
    }
  }
}

export async function applyTagsToContact(params: {
  tenantId: string;
  phone: string;
  tagsToAdd: string[];
  changedBy?: string;
}): Promise<Contact | null> {
  const phone = normalizePhone(params.phone);
  const existing = await getContactByPhone(params.tenantId, phone);
  if (!existing) return null;

  const mergedTags = [...new Set([...existing.tags, ...params.tagsToAdd])];
  const added = newlyAddedTags(existing.tags, mergedTags);
  if (!added.length) return existing;

  const updated = await updateContact(params.tenantId, phone, { tags: mergedTags });
  if (!updated) return null;

  await runTagActionsForNames({
    tenantId: params.tenantId,
    tagNames: added,
    phone,
    ...(params.changedBy ? { changedBy: params.changedBy } : {}),
  });

  return updated;
}

export async function removeTagsFromContact(params: {
  tenantId: string;
  phone: string;
  tagsToRemove: string[];
}): Promise<Contact | null> {
  const phone = normalizePhone(params.phone);
  const existing = await getContactByPhone(params.tenantId, phone);
  if (!existing) return null;

  const removeKeys = new Set(
    params.tagsToRemove.map(normalizeTagName).filter(Boolean)
  );
  if (!removeKeys.size) return existing;

  const remaining = existing.tags.filter(
    (tag) => !removeKeys.has(normalizeTagName(tag))
  );
  if (remaining.length === existing.tags.length) return existing;

  return updateContact(params.tenantId, phone, { tags: remaining });
}

export async function syncContactTagsAndRunActions(params: {
  tenantId: string;
  phone: string;
  previousTags: string[];
  nextTags: string[];
  changedBy?: string;
}): Promise<void> {
  const added = newlyAddedTags(params.previousTags, params.nextTags);
  if (!added.length) return;

  await runTagActionsForNames({
    tenantId: params.tenantId,
    tagNames: added,
    phone: normalizePhone(params.phone),
    ...(params.changedBy ? { changedBy: params.changedBy } : {}),
  });
}

export async function syncOpportunityTagsAndRunActions(params: {
  tenantId: string;
  opportunityId: string;
  phone?: string;
  previousTags: string[];
  nextTags: string[];
  changedBy?: string;
}): Promise<void> {
  const added = newlyAddedTags(params.previousTags, params.nextTags);
  if (!added.length) return;

  await runTagActionsForNames({
    tenantId: params.tenantId,
    tagNames: added,
    opportunityId: params.opportunityId,
    ...(params.phone ? { phone: params.phone } : {}),
    ...(params.changedBy ? { changedBy: params.changedBy } : {}),
  });
}
