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
  updateConversation,
  upsertMessageReaction,
} from "../dynamodb/conversation.repository.js";
import { generateChatResponse, getOpenAIApiKey } from "../openai/client.js";
import { callCustomWebhook } from "../webhook/client.js";
import { performHandoff, performInboxHandoff } from "../advisor/handoff.js";
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
import { getWhatsAppAccessTokenForAccount } from "../whatsapp/secrets.js";
import {
  extractWhatsAppIdentityChange,
  resolveWhatsAppIdentities,
} from "../whatsapp/identity.js";
import {
  applyWhatsAppIdentityChange,
  resolveCanonicalWhatsAppParticipant,
} from "../dynamodb/whatsapp-identity.repository.js";
import { getInstagramAccessToken } from "../instagram/secrets.js";
import { getTelegramBotToken } from "../telegram/secrets.js";
import { getMessengerAccessToken } from "../messenger/secrets.js";
import { truncateWhatsAppText } from "../whatsapp/client.js";
import type { InboundQueueMessage, Message } from "../../types/index.js";
import {
  assertPayloadMatchesChannel,
  externalMessageIdFromBody,
} from "./parse.js";
import { extractInboundReaction, isReactionInboundMessage } from "../whatsapp/inbound.js";
import { persistInboundWhatsAppMedia } from "../whatsapp/inbound-media.js";
import {
  handleInboundOrder,
  isOrderInbound,
} from "../catalog/order-handler.js";
import { recordCampaignReply } from "../dynamodb/campaign.repository.js";
import {
  getSystemMessage,
  getBotLocale,
  resolveConversationLocale,
} from "../i18n/index.js";
import {
  buildCtwaMessageMetadata,
  handleCtwaAttribution,
} from "../meta-ads/ctwa.js";

async function resolveAccessToken(
  tenantId: string,
  environment: string,
  channel: InboundQueueMessage["channel"],
  botId?: string,
  accountId?: string
): Promise<string | undefined> {
  if (channel === "whatsapp") {
    if (accountId) {
      return getWhatsAppAccessTokenForAccount(tenantId, accountId, environment);
    }
    return getWhatsAppAccessToken(tenantId, environment);
  }
  if (channel === "instagram") {
    return getInstagramAccessToken(tenantId, environment);
  }
  if (channel === "telegram" && botId) {
    return getTelegramBotToken(tenantId, botId, environment);
  }
  if (channel === "messenger" && botId) {
    return getMessengerAccessToken(tenantId, botId, environment);
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
  const locale = getBotLocale(conversation, bot);
  const outboundCtx = buildOutboundContext({
    tenantId: body.tenantId,
    botId: body.botId,
    bot,
    conversation,
    accessToken,
    environment: process.env.ENVIRONMENT ?? "dev",
    replyToExternalId,
  });
  await sendChannelText(outboundCtx, getClientHandoffMessage(locale));
}

async function executeHandoff(params: {
  body: InboundQueueMessage;
  bot: NonNullable<Awaited<ReturnType<typeof getBot>>>;
  conversation: Awaited<ReturnType<typeof getOrCreateConversation>>;
  accessToken?: string | undefined;
  replyToExternalId?: string | undefined;
  reason: "ai" | "webhook" | "no_ai";
  lastMessagePreview: string;
}): Promise<void> {
  await performHandoff({
    tenantId: params.body.tenantId,
    botId: params.body.botId,
    conversationId: params.conversation.conversationId,
    reason: params.reason,
  });

  if (params.accessToken || ["webchat", "sms", "email"].includes(params.body.channel)) {
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
  let responseBot = bot;

  const whatsappPayload =
    channel === "whatsapp"
      ? (body.payload as import("../../types/index.js").WhatsAppInboundPayload)
      : undefined;

  if (channel === "whatsapp" && whatsappPayload) {
    const identityChange = extractWhatsAppIdentityChange(whatsappPayload.message);
    if (identityChange) {
      await applyWhatsAppIdentityChange({
        tenantId,
        botId,
        change: identityChange,
        businessPhoneNumberId: whatsappPayload.phoneNumberId,
      });
      return;
    }
  }

  if (channel === "whatsapp" && whatsappPayload && isReactionInboundMessage(whatsappPayload.message)) {
    const reactionData = extractInboundReaction(whatsappPayload.message);
    if (!reactionData) return;

    const identities =
      resolveWhatsAppIdentities(whatsappPayload.message, whatsappPayload.contact) ?? {
        participantId,
        lookupIds: [participantId],
      };
    const resolvedIdentity = await resolveCanonicalWhatsAppParticipant({
      tenantId,
      botId,
      participantId: identities.participantId,
      ...(identities.phoneNumber ? { phoneNumber: identities.phoneNumber } : {}),
      ...(identities.whatsappUserId ? { whatsappUserId: identities.whatsappUserId } : {}),
      ...(identities.whatsappParentUserId
        ? { whatsappParentUserId: identities.whatsappParentUserId }
        : {}),
    });

    const conversation = await getOrCreateConversation(
      tenantId,
      botId,
      channel,
      resolvedIdentity.participantId,
      displayName,
      {
        ...(whatsappPayload.whatsappChannelId
          ? { channelId: whatsappPayload.whatsappChannelId }
          : {}),
        businessPhoneNumberId: whatsappPayload.phoneNumberId,
        ...(resolvedIdentity.whatsappUserId
          ? { whatsappUserId: resolvedIdentity.whatsappUserId }
          : {}),
        ...(resolvedIdentity.whatsappParentUserId
          ? { whatsappParentUserId: resolvedIdentity.whatsappParentUserId }
          : {}),
        ...(identities.whatsappUsername
          ? { whatsappUsername: identities.whatsappUsername }
          : {}),
        ...(resolvedIdentity.phoneNumber ? { phoneNumber: resolvedIdentity.phoneNumber } : {}),
        alternateParticipantIds: resolvedIdentity.lookupIds,
      }
    );

    await upsertMessageReaction({
      tenantId,
      botId,
      conversationId: conversation.conversationId,
      targetExternalMessageId: reactionData.targetMessageId,
      reaction: {
        emoji: reactionData.emoji,
        userId: participantId,
        role: "user",
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  const accessToken = await resolveAccessToken(
    tenantId,
    environment,
    channel,
    botId,
    whatsappPayload?.whatsappAccountId
  );

  let whatsappIdentity:
    | Awaited<ReturnType<typeof resolveCanonicalWhatsAppParticipant>>
    | undefined;
  let inboundWhatsAppIdentities: ReturnType<typeof resolveWhatsAppIdentities> | undefined;
  if (channel === "whatsapp" && whatsappPayload) {
    inboundWhatsAppIdentities =
      resolveWhatsAppIdentities(whatsappPayload.message, whatsappPayload.contact) ?? {
        participantId,
        lookupIds: [participantId],
      };
    whatsappIdentity = await resolveCanonicalWhatsAppParticipant({
      tenantId,
      botId,
      participantId: inboundWhatsAppIdentities.participantId || participantId,
      ...(inboundWhatsAppIdentities.phoneNumber
        ? { phoneNumber: inboundWhatsAppIdentities.phoneNumber }
        : {}),
      ...(inboundWhatsAppIdentities.whatsappUserId
        ? { whatsappUserId: inboundWhatsAppIdentities.whatsappUserId }
        : {}),
      ...(inboundWhatsAppIdentities.whatsappParentUserId
        ? { whatsappParentUserId: inboundWhatsAppIdentities.whatsappParentUserId }
        : {}),
    });
  }

  let conversation = await getOrCreateConversation(
    tenantId,
    botId,
    channel,
    whatsappIdentity?.participantId ?? participantId,
    displayName,
    whatsappPayload
      ? {
          ...(whatsappPayload.whatsappChannelId
            ? { channelId: whatsappPayload.whatsappChannelId }
            : {}),
          businessPhoneNumberId: whatsappPayload.phoneNumberId,
          ...(whatsappIdentity?.whatsappUserId
            ? { whatsappUserId: whatsappIdentity.whatsappUserId }
            : {}),
          ...(whatsappIdentity?.whatsappParentUserId
            ? { whatsappParentUserId: whatsappIdentity.whatsappParentUserId }
            : {}),
          ...(inboundWhatsAppIdentities?.whatsappUsername
            ? { whatsappUsername: inboundWhatsAppIdentities.whatsappUsername }
            : {}),
          ...(whatsappIdentity?.phoneNumber
            ? { phoneNumber: whatsappIdentity.phoneNumber }
            : {}),
          ...(whatsappIdentity ? { alternateParticipantIds: whatsappIdentity.lookupIds } : {}),
        }
      : undefined
  );

  if (channel === "email") {
    const emailPayload = body.payload as import("../../types/index.js").EmailInboundPayload;
    const { updateConversation } = await import("../dynamodb/conversation.repository.js");
    const updated = await updateConversation(tenantId, botId, conversation.conversationId, {
      emailSubject: emailPayload.subject,
      emailThreadMessageId: emailPayload.messageId,
    });
    if (updated) conversation = updated;
  }

  if (channel === "whatsapp" && whatsappPayload) {
    conversation = await handleCtwaAttribution({
      tenantId,
      botId,
      conversation,
      message: whatsappPayload.message,
      participantId,
      ...(displayName ? { displayName } : {}),
    });
  }

  const ctwaMetadata =
    channel === "whatsapp" && whatsappPayload
      ? buildCtwaMessageMetadata(whatsappPayload.message)
      : undefined;

  const emailMetadata =
    channel === "email"
      ? (await import("../email/mime.js")).buildEmailMessageMetadata(
          body.payload as import("../../types/index.js").EmailInboundPayload
        )
      : undefined;

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

  await recordCampaignReply(tenantId, participantId, conversation.conversationId).catch((err) =>
    console.warn("Failed to record campaign reply:", err)
  );

  await markChannelRead(outboundCtxBase(), externalId).catch(() => {});

  const history = await getConversationMessages(tenantId, conversation.conversationId, 20);
  const existingUserIdx = history.findIndex(
    (m) => m.messageId === externalId && m.role === "user"
  );
  const inboundAlreadyPersisted = existingUserIdx >= 0;
  if (inboundAlreadyPersisted) {
    const hasLaterReply = history
      .slice(existingUserIdx + 1)
      .some((m) => m.role === "assistant" || m.role === "advisor");
    if (hasLaterReply) {
      console.log(`Skipping duplicate inbound message ${externalId}`);
      return;
    }
    console.log(`Resuming incomplete inbound message ${externalId}`);
  }
  const userMessageText = inbound.text;
  const detectedLocale = resolveConversationLocale({
    userMessage: userMessageText,
    conversationLocale: conversation.locale,
    botDefaultLocale: bot.defaultLocale,
  });
  if (detectedLocale !== conversation.locale) {
    const localeUpdated = await updateConversation(tenantId, botId, conversation.conversationId, {
      locale: detectedLocale,
    });
    if (localeUpdated) conversation = localeUpdated;
  }
  const conversationLocale = getBotLocale(conversation, bot);
  const now = new Date().toISOString();
  const source = inboundSourceForChannel(channel);

  if (channel === "whatsapp" && isOrderInbound(inbound) && inbound.order) {
    const orderResult = await handleInboundOrder({
      tenantId,
      botId,
      conversationId: conversation.conversationId,
      contactPhone: participantId,
      ...(displayName ? { contactName: displayName } : {}),
      whatsappMessageId: externalId,
      order: inbound.order,
      environment,
    });

    if (orderResult.handled) {
      const userMessage: Message = {
        messageId: externalId,
        conversationId: conversation.conversationId,
        tenantId,
        role: "user",
        content: inbound.text,
        channel,
        messageType: "order",
        metadata: { orderId: orderResult.orderId },
        source,
        externalMessageId: externalId,
        whatsappMessageId: externalId,
        timestamp: new Date().toISOString(),
      };
      await addMessage(userMessage, botId);
      await emitMessageReceived({
        tenantId,
        botId,
        conversationId: conversation.conversationId,
        channel,
        from: participantId,
        message: inbound.text,
        contactName: displayName,
      });
      return;
    }
  }

  let attachmentMetadata: Record<string, unknown> | undefined;
  if (
    channel === "whatsapp" &&
    whatsappPayload &&
    accessToken &&
    (inbound.messageType === "image" || inbound.messageType === "audio")
  ) {
    const persisted = await persistInboundWhatsAppMedia({
      tenantId,
      botId,
      conversationId: conversation.conversationId,
      message: whatsappPayload.message,
      accessToken,
    }).catch((err) => {
      console.error(
        `Failed to persist inbound WhatsApp media messageId=${externalId}:`,
        err
      );
      return null;
    });
    if (persisted) {
      attachmentMetadata = persisted as unknown as Record<string, unknown>;
    }
  }

  const messageMetadata: Record<string, unknown> = {
    ...(inbound.interactive?.responseJson
      ? { responseJson: inbound.interactive.responseJson }
      : {}),
    ...(ctwaMetadata ?? {}),
    ...(emailMetadata ?? {}),
    ...(attachmentMetadata ?? {}),
  };

  let persistedUserContent = userMessageText;
  if (attachmentMetadata && typeof attachmentMetadata.filename === "string") {
    if (inbound.messageType === "audio") {
      persistedUserContent = attachmentMetadata.filename;
    } else if (inbound.messageType === "image") {
      const caption = whatsappPayload?.message.image?.caption?.trim();
      persistedUserContent = caption || attachmentMetadata.filename;
    }
  }

  const userMessage: Message = {
    messageId: externalId,
    conversationId: conversation.conversationId,
    tenantId,
    role: "user",
    content: persistedUserContent,
    channel,
    messageType: inbound.messageType,
    ...(Object.keys(messageMetadata).length > 0 ? { metadata: messageMetadata } : {}),
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

  if (!inboundAlreadyPersisted) {
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
  } else {
    const refreshed = await updateConversation(tenantId, botId, conversation.conversationId, {
      lastInboundAt: now,
      lastMessageAt: now,
    });
    if (refreshed) conversation = refreshed;
  }

  let flowAdvance: Awaited<ReturnType<typeof advanceFlowRun>> = {
    handled: false,
    halt: false,
  };
  try {
    flowAdvance = await advanceFlowRun({
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
  } catch (err) {
    console.error(
      `Flow advance failed tenant=${tenantId} bot=${botId} conversation=${conversation.conversationId}:`,
      err
    );
    flowAdvance = { handled: false, halt: false };
  }

  if (flowAdvance.handled) {
    if (flowAdvance.errorMessage) {
      console.warn(
        `Flow run failed tenant=${tenantId} bot=${botId} conversation=${conversation.conversationId}: ${flowAdvance.errorMessage}`
      );
    }
    if (flowAdvance.halt) return;
    if (flowAdvance.continueWithBotId && flowAdvance.continueWithBotId !== responseBot.botId) {
      const nextBot = await getBot(tenantId, flowAdvance.continueWithBotId);
      if (nextBot) responseBot = nextBot;
    }
  }

  if (!flowAdvance.handled) {
    const enabledFlows = await listEnabledFlowsForBot(tenantId, botId);
    const matchedFlow = findTriggerFlow(enabledFlows, inbound, conversation, isNewConversation);
    if (matchedFlow) {
      try {
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
          if (flowStart.errorMessage) {
            console.warn(
              `Flow start failed tenant=${tenantId} bot=${botId} flow=${matchedFlow.flowId}: ${flowStart.errorMessage}`
            );
          }
          if (flowStart.halt) return;
          if (flowStart.continueWithBotId && flowStart.continueWithBotId !== responseBot.botId) {
            const nextBot = await getBot(tenantId, flowStart.continueWithBotId);
            if (nextBot) responseBot = nextBot;
          }
        }
      } catch (err) {
        console.error(
          `Flow start failed tenant=${tenantId} bot=${botId} flow=${matchedFlow.flowId}:`,
          err
        );
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
      return;
    }
  }

  conversation = (await getConversation(tenantId, botId, conversation.conversationId)) ?? conversation;

  if ((conversation.handoffMode ?? "bot") === "human") {
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
  let handoffReason: "ai" | "webhook" | "no_ai" = "ai";

  if (responseBot.responseMode === "none") {
    const handedOff = await performInboxHandoff({
      tenantId,
      botId,
      conversationId: conversation.conversationId,
      reason: "no_ai",
    });

    if (handedOff) {
      await notifyAdvisorOfConversation({
        tenantId,
        botId,
        conversation: handedOff,
        phoneNumberId,
        accessToken: accessToken ?? "",
        lastMessagePreview: userMessageText,
        force: true,
      });
    }

    return;
  }

  if (responseBot.responseMode === "webhook" && responseBot.webhookUrl) {
    const webhookResult = await callCustomWebhook(
      responseBot.webhookUrl,
      responseBot.webhookSecret,
      {
        message: userMessageText,
        from: participantId,
        conversationId: conversation.conversationId,
        botId: responseBot.botId,
        contact: { name: contactName ?? "" },
        channel,
        locale: conversationLocale,
      }
    );
    if (webhookResult.handoff) {
      shouldHandoff = true;
      handoffReason = "webhook";
    } else {
      aiResponse = webhookResult.reply;
    }
  } else {
    let openAIKey: string;
    try {
      openAIKey = await getOpenAIApiKey(tenantId, environment);
    } catch (keyErr) {
      const keyErrMsg = (keyErr as Error).message ?? "";
      if (channel === "webchat" && keyErrMsg.includes("No OpenAI API key configured")) {
        const fallback = getSystemMessage("assistantUnavailable", conversationLocale);
        await sendChannelText(
          buildOutboundContext({
            tenantId,
            botId,
            bot,
            conversation,
            accessToken,
            environment,
          }),
          fallback
        );
        await emitMessageSent({
          tenantId,
          botId,
          conversationId: conversation.conversationId,
          channel,
          to: participantId,
          message: fallback,
          role: "assistant",
        });
        return;
      }
      throw keyErr;
    }
    const result = await generateChatResponse(
      responseBot,
      history,
      userMessageText,
      openAIKey,
      tenantId,
      { contactPhone: participantId, conversationId: conversation.conversationId },
      conversationLocale
    );
    if (result.handoff) {
      shouldHandoff = true;
    } else {
      aiResponse = result.reply;
    }
  }

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
      return;
    } catch (handoffErr) {
      const handoffErrMsg = (handoffErr as Error).message ?? "";
      if (handoffErrMsg.includes("No active advisors")) {
        const openAIKey = await getOpenAIApiKey(tenantId, environment);
        const fallback = await generateChatResponse(
          responseBot,
          history,
          userMessageText,
          openAIKey,
          tenantId,
          { contactPhone: participantId, conversationId: conversation.conversationId },
          conversationLocale
        );
        aiResponse =
          fallback.reply ?? getSystemMessage("noAdvisorsAvailable", conversationLocale);
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

  if (channel === "webchat") {
    const assistantMessage: Message = {
      messageId: aiMessageId,
      conversationId: conversation.conversationId,
      tenantId,
      role: "assistant",
      content: outboundText,
      channel,
      timestamp: aiTimestamp,
    };
    await addMessage(assistantMessage, botId);
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
    const sendResult = await sendChannelText(outboundCtxBase(), outboundText);
    const externalMessageId = sendResult.externalMessageId;
    const assistantMessage: Message = {
      messageId: externalMessageId ?? aiMessageId,
      conversationId: conversation.conversationId,
      tenantId,
      role: "assistant",
      content: outboundText,
      channel,
      timestamp: aiTimestamp,
      ...(externalMessageId
        ? {
            externalMessageId,
            ...(channel === "whatsapp" ? { whatsappMessageId: externalMessageId } : {}),
          }
        : {}),
    };
    await addMessage(assistantMessage, botId);
  }

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
