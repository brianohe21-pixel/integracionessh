import { randomUUID } from "crypto";
import { getBot } from "../dynamodb/bot.repository.js";
import { getTenant } from "../dynamodb/tenant.repository.js";
import { assertCanSendMessages } from "../billing/assert-plan.js";
import { incrementMessages } from "../dynamodb/usage.repository.js";
import { PlanLimitError } from "../billing/plan-limits.js";
import {
  getOrCreateConversation,
  getConversation,
  getConversationMessages,
  addMessage,
  clearMetaFlowSession,
} from "../dynamodb/conversation.repository.js";
import { generateChatResponse, getOpenAIApiKey } from "../openai/client.js";
import { callCustomWebhook } from "../webhook/client.js";
import { performHandoff } from "../advisor/handoff.js";
import {
  getClientHandoffMessage,
  notifyAdvisorOfConversation,
} from "../advisor/notify.js";
import { evaluateAutomations, evaluateFlowCompletedAutomations } from "../automation/evaluate.js";
import { executeAutomation } from "../automation/execute.js";
import { createFlowResponse } from "../dynamodb/meta-flow.repository.js";
import { createLeadFromFlowResponse } from "../leads/convert.js";
import { listEnabledFlowsForBot } from "../dynamodb/flow.repository.js";
import { advanceFlowRun, startFlowRun } from "../flow/interpreter.js";
import { findTriggerFlow } from "../flow/match-trigger.js";
import { emitIntegrationEvent } from "../integrations/emit.js";
import {
  buildFlowCompletedPayload,
  buildMessageReceivedPayload,
  buildMessageSentPayload,
} from "../integrations/payloads.js";
import {
  buildOutboundContext,
  getChannelAdapter,
  markChannelRead,
  sendChannelText,
} from "../channels/router.js";
import { inboundSourceForChannel } from "../channels/types.js";
import { getWhatsAppAccessToken } from "../whatsapp/client.js";
import { getInstagramAccessToken } from "../instagram/secrets.js";
import { truncateWhatsAppText } from "../whatsapp/client.js";
import type { InboundQueueMessage, Message } from "../../types/index.js";
import {
  assertPayloadMatchesChannel,
  externalMessageIdFromBody,
} from "./parse.js";

async function resolveAccessToken(
  tenantId: string,
  environment: string,
  channel: InboundQueueMessage["channel"]
): Promise<string | undefined> {
  if (channel === "whatsapp") {
    return getWhatsAppAccessToken(tenantId, environment);
  }
  if (channel === "instagram") {
    return getInstagramAccessToken(tenantId, environment);
  }
  return undefined;
}

async function emitMessageReceived(params: {
  tenantId: string;
  botId: string;
  conversationId: string;
  channel: InboundQueueMessage["channel"];
  from: string;
  message: string;
  contactName: string | undefined;
}): Promise<void> {
  await emitIntegrationEvent(
    params.tenantId,
    "message.received",
    buildMessageReceivedPayload({
      tenantId: params.tenantId,
      botId: params.botId,
      conversationId: params.conversationId,
      channel: params.channel,
      from: params.from,
      message: params.message,
      ...(params.contactName ? { contactName: params.contactName } : {}),
    })
  ).catch((err) => console.error("Failed to emit message.received:", err));
}

async function emitMessageSent(params: {
  tenantId: string;
  botId: string;
  conversationId: string;
  channel: InboundQueueMessage["channel"];
  to: string;
  message: string;
  role: string;
}): Promise<void> {
  await emitIntegrationEvent(
    params.tenantId,
    "message.sent",
    buildMessageSentPayload(params)
  ).catch((err) => console.error("Failed to emit message.sent:", err));
}

async function sendHandoffCourtesy(
  body: InboundQueueMessage,
  bot: NonNullable<Awaited<ReturnType<typeof getBot>>>,
  conversation: Awaited<ReturnType<typeof getOrCreateConversation>>,
  accessToken: string | undefined,
  replyToExternalId?: string
): Promise<void> {
  const outboundCtx = buildOutboundContext({
    tenantId: body.tenantId,
    botId: body.botId,
    bot,
    conversation,
    accessToken,
    environment: process.env.ENVIRONMENT ?? "dev",
    replyToExternalId,
  });
  await sendChannelText(outboundCtx, getClientHandoffMessage());
}

async function executeHandoff(params: {
  body: InboundQueueMessage;
  bot: NonNullable<Awaited<ReturnType<typeof getBot>>>;
  conversation: Awaited<ReturnType<typeof getOrCreateConversation>>;
  accessToken?: string | undefined;
  replyToExternalId?: string | undefined;
  reason: "ai" | "webhook";
  lastMessagePreview: string;
}): Promise<void> {
  await performHandoff({
    tenantId: params.body.tenantId,
    botId: params.body.botId,
    conversationId: params.conversation.conversationId,
    reason: params.reason,
  });

  if (params.accessToken || params.body.channel === "webchat") {
    await sendHandoffCourtesy(
      params.body,
      params.bot,
      params.conversation,
      params.accessToken,
      params.replyToExternalId
    );
  }

  const updated = await getConversation(
    params.body.tenantId,
    params.body.botId,
    params.conversation.conversationId
  );

  if (updated) {
    await notifyAdvisorOfConversation({
      tenantId: params.body.tenantId,
      botId: params.body.botId,
      conversation: updated,
      phoneNumberId: params.bot.phoneNumberId,
      accessToken: params.accessToken ?? "",
      lastMessagePreview: params.lastMessagePreview,
      force: true,
    });
  }
}

export async function processInboundMessage(
  body: InboundQueueMessage,
  environment: string
): Promise<void> {
  assertPayloadMatchesChannel(body);

  const { tenantId, botId, channel, participantId, displayName } = body;
  const adapter = getChannelAdapter(channel);
  const inbound = adapter.normalizeInbound(body.payload);
  const externalId = externalMessageIdFromBody(body);

  const bot = await getBot(tenantId, botId);
  if (!bot) {
    console.error(`Bot not found: tenantId=${tenantId} botId=${botId}`);
    return;
  }

  const accessToken = await resolveAccessToken(tenantId, environment, channel);

  const outboundCtxBase = () =>
    buildOutboundContext({
      tenantId,
      botId,
      bot,
      conversation,
      accessToken,
      environment,
      replyToExternalId: externalId,
    });

  let conversation = await getOrCreateConversation(
    tenantId,
    botId,
    channel,
    participantId,
    displayName
  );

  await markChannelRead(outboundCtxBase(), externalId).catch(() => {});

  const history = await getConversationMessages(tenantId, conversation.conversationId, 20);
  const userMessageText = inbound.text;
  const now = new Date().toISOString();
  const source = inboundSourceForChannel(channel);

  const userMessage: Message = {
    messageId: externalId,
    conversationId: conversation.conversationId,
    tenantId,
    role: "user",
    content: userMessageText,
    channel,
    messageType: inbound.messageType,
    ...(inbound.interactive?.responseJson
      ? { metadata: { responseJson: inbound.interactive.responseJson } }
      : {}),
    source,
    externalMessageId: externalId,
    ...(channel === "whatsapp" ? { whatsappMessageId: externalId } : {}),
    timestamp: now,
  };

  if (
    channel === "whatsapp" &&
    inbound.interactive?.kind === "nfm" &&
    inbound.interactive.responseJson
  ) {
    let responseJson: Record<string, unknown> = {};
    try {
      responseJson = JSON.parse(inbound.interactive.responseJson) as Record<string, unknown>;
    } catch {
      responseJson = { raw: inbound.interactive.responseJson };
    }
    const metaFlowId = conversation.pendingMetaFlowId ?? "unknown";
    await createFlowResponse({
      responseId: externalId,
      tenantId,
      botId,
      conversationId: conversation.conversationId,
      phone: participantId,
      metaFlowId,
      responseJson,
      createdAt: now,
    });

    const lead = await createLeadFromFlowResponse({
      tenantId,
      botId,
      conversationId: conversation.conversationId,
      phone: participantId,
      metaFlowId,
      flowResponseId: externalId,
      responseJson,
      createdAt: now,
    }).catch((err) => {
      console.error("Failed to create lead from flow response:", err);
      return null;
    });

    await emitIntegrationEvent(
      tenantId,
      "flow.completed",
      buildFlowCompletedPayload({
        tenantId,
        botId,
        conversationId: conversation.conversationId,
        phone: participantId,
        metaFlowId,
        responseJson,
        channel,
      })
    ).catch((err) => console.error("Failed to emit flow.completed:", err));

    if (lead) {
      const flowRule = await evaluateFlowCompletedAutomations({
        tenantId,
        botId,
        metaFlowId,
        conversation,
      });
      if (flowRule) {
        await executeAutomation(flowRule, {
          tenantId,
          botId,
          bot,
          conversation,
          phoneNumberId:
            channel === "whatsapp"
              ? (body.payload as import("../../types/index.js").WhatsAppInboundPayload).phoneNumberId
              : bot.phoneNumberId,
          accessToken: accessToken ?? "",
          customerPhone: participantId,
          replyToMessageId: externalId,
          channel,
        }).catch((err) => console.error("Failed to execute flow_completed automation:", err));
      }
    }

    await clearMetaFlowSession(tenantId, botId, conversation.conversationId);
  }

  const tenant = await getTenant(tenantId);
  if (tenant) {
    try {
      await assertCanSendMessages(tenant);
    } catch (err) {
      if (err instanceof PlanLimitError) {
        console.warn(`Plan limit for tenant ${tenantId}:`, err.message);
        return;
      }
      throw err;
    }
  }

  const contactName = displayName ?? conversation.contactName;
  const isNewConversation = conversation.messageCount === 0 && !conversation.welcomeSentAt;
  const phoneNumberId =
    channel === "whatsapp"
      ? (body.payload as import("../../types/index.js").WhatsAppInboundPayload).phoneNumberId
      : bot.phoneNumberId;

  const flowAdvance = await advanceFlowRun({
    tenantId,
    botId,
    bot,
    conversation,
    phoneNumberId,
    accessToken: accessToken ?? "",
    customerPhone: participantId,
    replyToMessageId: externalId,
    inbound,
    channel,
  });

  if (flowAdvance.handled) {
    await addMessage(userMessage, botId);
    await emitMessageReceived({
      tenantId,
      botId,
      conversationId: conversation.conversationId,
      channel,
      from: participantId,
      message: userMessageText,
      contactName,
    });
    await incrementMessages(tenantId);
    if (flowAdvance.halt) return;
  }

  if (!flowAdvance.handled) {
    const enabledFlows = await listEnabledFlowsForBot(tenantId, botId);
    const matchedFlow = findTriggerFlow(enabledFlows, inbound, conversation, isNewConversation);
    if (matchedFlow) {
      const flowStart = await startFlowRun({
        flow: matchedFlow,
        tenantId,
        botId,
        bot,
        conversation,
        phoneNumberId,
        accessToken: accessToken ?? "",
        customerPhone: participantId,
        replyToMessageId: externalId,
        inbound,
        channel,
      });
      if (flowStart.handled) {
        await addMessage(userMessage, botId);
        await emitMessageReceived({
          tenantId,
          botId,
          conversationId: conversation.conversationId,
          channel,
          from: participantId,
          message: userMessageText,
          contactName,
        });
        await incrementMessages(tenantId);
        if (flowStart.halt) return;
      }
    }
  }

  const inboundTriggers = isNewConversation
    ? (["first_message", "keyword"] as const)
    : (["keyword"] as const);

  const matchedRule = await evaluateAutomations({
    tenantId,
    botId,
    triggers: [...inboundTriggers],
    text: userMessageText,
    conversation,
    isNewConversation,
  });

  if (matchedRule) {
    await executeAutomation(matchedRule, {
      tenantId,
      botId,
      bot,
      conversation,
      phoneNumberId,
      accessToken: accessToken ?? "",
      customerPhone: participantId,
      replyToMessageId: externalId,
      channel,
    });

    if (matchedRule.stopProcessing !== false) {
      await addMessage(userMessage, botId);
      await emitMessageReceived({
        tenantId,
        botId,
        conversationId: conversation.conversationId,
        channel,
        from: participantId,
        message: userMessageText,
        contactName,
      });
      await incrementMessages(tenantId);
      return;
    }
  }

  conversation = (await getConversation(tenantId, botId, conversation.conversationId)) ?? conversation;

  if ((conversation.handoffMode ?? "bot") === "human") {
    await addMessage(userMessage, botId);
    await emitMessageReceived({
      tenantId,
      botId,
      conversationId: conversation.conversationId,
      channel,
      from: participantId,
      message: userMessageText,
      contactName,
    });
    await incrementMessages(tenantId);

    const refreshed = await getConversation(tenantId, botId, conversation.conversationId);
    if (refreshed) {
      await notifyAdvisorOfConversation({
        tenantId,
        botId,
        conversation: refreshed,
        phoneNumberId,
        accessToken: accessToken ?? "",
        lastMessagePreview: userMessageText,
      });
    }
    return;
  }

  let aiResponse: string | null = null;
  let shouldHandoff = false;
  let handoffReason: "ai" | "webhook" = "ai";

  if (bot.responseMode === "webhook" && bot.webhookUrl) {
    const webhookResult = await callCustomWebhook(bot.webhookUrl, bot.webhookSecret, {
      message: userMessageText,
      from: participantId,
      conversationId: conversation.conversationId,
      botId,
      contact: { name: contactName ?? "" },
      channel,
    });
    if (webhookResult.handoff) {
      shouldHandoff = true;
      handoffReason = "webhook";
    } else {
      aiResponse = webhookResult.reply;
    }
  } else {
    const openAIKey = await getOpenAIApiKey(tenantId, environment);
    const result = await generateChatResponse(
      bot,
      history,
      userMessageText,
      openAIKey,
      tenantId,
      { contactPhone: participantId, conversationId: conversation.conversationId }
    );
    if (result.handoff) {
      shouldHandoff = true;
    } else {
      aiResponse = result.reply;
    }
  }

  await addMessage(userMessage, botId);
  await emitMessageReceived({
    tenantId,
    botId,
    conversationId: conversation.conversationId,
    channel,
    from: participantId,
    message: userMessageText,
    contactName,
  });

  if (shouldHandoff) {
    try {
      await executeHandoff({
        body,
        bot,
        conversation,
        accessToken,
        replyToExternalId: externalId,
        reason: handoffReason,
        lastMessagePreview: userMessageText,
      });
      await incrementMessages(tenantId);
      return;
    } catch (handoffErr) {
      const handoffErrMsg = (handoffErr as Error).message ?? "";
      if (handoffErrMsg.includes("No active advisors")) {
        const openAIKey = await getOpenAIApiKey(tenantId, environment);
        const fallback = await generateChatResponse(
          bot,
          history,
          userMessageText,
          openAIKey,
          tenantId,
          { contactPhone: participantId, conversationId: conversation.conversationId }
        );
        aiResponse =
          fallback.reply ??
          "En este momento no tenemos asesores disponibles. ¿Puedo ayudarte con algo más?";
      } else {
        throw handoffErr;
      }
    }
  }

  if (!aiResponse) {
    throw new Error("No AI response generated");
  }

  const outboundText = channel === "whatsapp" ? truncateWhatsAppText(aiResponse) : aiResponse;
  const aiMessageId = `ai-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const aiTimestamp = new Date().toISOString();

  const assistantMessage: Message = {
    messageId: aiMessageId,
    conversationId: conversation.conversationId,
    tenantId,
    role: "assistant",
    content: outboundText,
    channel,
    timestamp: aiTimestamp,
  };

  if (channel === "webchat") {
    await sendChannelText(
      buildOutboundContext({
        tenantId,
        botId,
        bot,
        conversation,
        accessToken,
        environment,
      }),
      outboundText
    );
  } else {
    await addMessage(assistantMessage, botId);
    await sendChannelText(outboundCtxBase(), outboundText);
  }

  await incrementMessages(tenantId);

  await emitMessageSent({
    tenantId,
    botId,
    conversationId: conversation.conversationId,
    channel,
    to: participantId,
    message: outboundText,
    role: "assistant",
  });
}
