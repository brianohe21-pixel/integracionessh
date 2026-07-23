import { randomUUID } from "crypto";
import {
  addMessage,
  clearConversationHandoff,
  getConversation,
  getConversationMessages,
  updateConversation,
} from "../dynamodb/conversation.repository.js";
import { getAdvisor, touchAdvisorAssignment } from "../dynamodb/advisor.repository.js";
import { getBot } from "../dynamodb/bot.repository.js";
import { getTenant } from "../dynamodb/tenant.repository.js";
import { pickAdvisor } from "./pick.js";
import { generateCopilotInsights } from "./copilot.js";
import { assertCanUseCopilot } from "../billing/assert-plan.js";
import { emitIntegrationEvent } from "../integrations/emit.js";
import { buildConversationHandoffPayload } from "../integrations/payloads.js";
import { publishRealtimeEventSafe } from "../realtime/publish.js";
import type { Conversation, HandoffReason, Message } from "../../types/index.js";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";

function scheduleCopilotInsights(params: {
  tenantId: string;
  botId: string;
  conversationId: string;
}): void {
  void (async () => {
    try {
      const tenant = await getTenant(params.tenantId);
      if (!tenant) return;
      assertCanUseCopilot(tenant);

      const bot = await getBot(params.tenantId, params.botId);
      if (!bot) return;

      const messages = await getConversationMessages(
        params.tenantId,
        params.conversationId,
        50
      );
      const insights = await generateCopilotInsights({
        bot,
        messages,
        tenantId: params.tenantId,
        environment: ENVIRONMENT,
      });

      const updated = await updateConversation(
        params.tenantId,
        params.botId,
        params.conversationId,
        {
          copilotSummary: insights.copilotSummary,
          detectedIntent: insights.detectedIntent,
          copilotGeneratedAt: new Date().toISOString(),
        }
      );

      if (updated) {
        publishRealtimeEventSafe(params.tenantId, {
          type: "conversation.updated",
          conversation: updated,
        });
      }
    } catch (err) {
      console.error("Copilot insights generation failed:", err);
    }
  })();
}

export async function performHandoff(params: {
  tenantId: string;
  botId: string;
  conversationId: string;
  advisorId?: string;
  reason: HandoffReason;
}): Promise<Conversation | null> {
  const existing = await getConversation(params.tenantId, params.botId, params.conversationId);
  if (!existing) return null;

  let advisorId = params.advisorId;
  if (advisorId) {
    const advisor = await getAdvisor(params.tenantId, advisorId);
    if (!advisor || advisor.status !== "active") {
      throw new Error("Advisor not found or inactive");
    }
    await touchAdvisorAssignment(params.tenantId, advisorId);
  } else {
    const picked = await pickAdvisor(params.tenantId, params.botId);
    if (!picked) {
      throw new Error("No active advisors available for this bot");
    }
    advisorId = picked.advisorId;
  }

  const now = new Date().toISOString();

  const updated = await updateConversation(
    params.tenantId,
    params.botId,
    params.conversationId,
    {
      handoffMode: "human",
      assignedAdvisorId: advisorId,
      handoffAt: now,
      handoffReason: params.reason,
      workflowStatus: "new",
      status: "active",
    }
  );

  const systemMessage: Message = {
    messageId: `sys-${randomUUID()}`,
    conversationId: params.conversationId,
    tenantId: params.tenantId,
    role: "system",
    content: `Conversation transferred to advisor (${params.reason})`,
    timestamp: now,
  };

  await addMessage(systemMessage, params.botId);

  if (updated) {
    publishRealtimeEventSafe(params.tenantId, {
      type: "conversation.handoff",
      conversation: updated,
    });

    await emitIntegrationEvent(
      params.tenantId,
      "conversation.handoff",
      buildConversationHandoffPayload({
        tenantId: params.tenantId,
        botId: params.botId,
        conversationId: params.conversationId,
        phoneNumber: updated.phoneNumber,
        reason: params.reason,
        advisorId,
      })
    ).catch((err) => console.error("Failed to emit handoff integration event:", err));

    scheduleCopilotInsights({
      tenantId: params.tenantId,
      botId: params.botId,
      conversationId: params.conversationId,
    });
  }

  return updated;
}

export async function releaseToBot(params: {
  tenantId: string;
  botId: string;
  conversationId: string;
}): Promise<Conversation | null> {
  const existing = await getConversation(params.tenantId, params.botId, params.conversationId);
  if (!existing) return null;

  const now = new Date().toISOString();

  const updated = await clearConversationHandoff(
    params.tenantId,
    params.botId,
    params.conversationId
  );

  const systemMessage: Message = {
    messageId: `sys-${randomUUID()}`,
    conversationId: params.conversationId,
    tenantId: params.tenantId,
    role: "system",
    content: "Conversation returned to automated bot",
    timestamp: now,
  };

  await addMessage(systemMessage, params.botId);

  return updated;
}
