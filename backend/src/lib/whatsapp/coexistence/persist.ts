import { getBot } from "../../dynamodb/bot.repository.js";
import {
  addMessageIdempotent,
  getOrCreateConversation,
  updateConversation,
} from "../../dynamodb/conversation.repository.js";
import type {
  Bot,
  WhatsAppHistoryChunk,
  WhatsAppHistoryMessage,
  WhatsAppMessageEcho,
  WhatsAppStateSyncItem,
} from "../../../types/index.js";
import { buildMessageFromEcho, buildMessageFromHistory } from "./map-message.js";
import { upsertCoexistenceContact } from "./contacts.js";

export async function persistCoexistenceHistoryChunk(params: {
  bot: Bot;
  businessPhone: string;
  phoneNumberId: string;
  chunk: WhatsAppHistoryChunk;
}): Promise<void> {
  const { bot, businessPhone, chunk } = params;
  const chunkMeta = {
    phase: chunk.metadata?.phase,
    chunkOrder: chunk.metadata?.chunk_order,
    progress: chunk.metadata?.progress,
  };

  if (chunk.errors?.some((e) => e.code === 2593109)) {
    return;
  }

  const threads = chunk.threads ?? [];
  for (const thread of threads) {
    const participantId = thread.id;
    const sorted = [...(thread.messages ?? [])].sort(
      (a, b) => Number(a.timestamp) - Number(b.timestamp)
    );

    const conversation = await getOrCreateConversation(
      bot.tenantId,
      bot.botId,
      "whatsapp",
      participantId
    );

    for (const waMessage of sorted) {
      const message = buildMessageFromHistory({
        tenantId: bot.tenantId,
        conversationId: conversation.conversationId,
        threadParticipantId: participantId,
        businessPhone,
        message: waMessage,
        metadata: chunkMeta,
      });

      await addMessageIdempotent(message, bot.botId, {
        updateCounters: false,
        updateLastMessageAt: false,
        publishRealtime: true,
      });
    }

    if (sorted.length > 0) {
      const last = sorted[sorted.length - 1];
      const lastTs = new Date(Number(last.timestamp) * 1000).toISOString();
      await updateConversation(bot.tenantId, bot.botId, conversation.conversationId, {
        lastMessageAt: lastTs,
      });
    }
  }
}

export async function persistCoexistenceEchoes(params: {
  bot: Bot;
  echoes: WhatsAppMessageEcho[];
}): Promise<void> {
  const { bot, echoes } = params;

  for (const echo of echoes) {
    const participantId = echo.to;
    const conversation = await getOrCreateConversation(
      bot.tenantId,
      bot.botId,
      "whatsapp",
      participantId
    );

    const message = buildMessageFromEcho({
      tenantId: bot.tenantId,
      conversationId: conversation.conversationId,
      echo,
    });

    const inserted = await addMessageIdempotent(message, bot.botId, {
      updateCounters: true,
      updateLastMessageAt: true,
      publishRealtime: true,
    });

    if (inserted && (conversation.handoffMode ?? "bot") === "bot") {
      await updateConversation(bot.tenantId, bot.botId, conversation.conversationId, {
        handoffMode: "human",
        handoffReason: "manual",
        handoffAt: new Date().toISOString(),
        workflowStatus: "open",
      });
    }
  }
}

export async function persistCoexistenceContacts(params: {
  bot: Bot;
  items: WhatsAppStateSyncItem[];
}): Promise<void> {
  for (const item of params.items) {
    if (item.type !== "contact" || !item.contact?.phone_number) continue;
    await upsertCoexistenceContact({
      tenantId: params.bot.tenantId,
      botId: params.bot.botId,
      phone: item.contact.phone_number,
      ...(item.contact.full_name || item.contact.first_name
        ? { displayName: item.contact.full_name ?? item.contact.first_name }
        : {}),
      action: item.action ?? "add",
    });
  }
}

export async function loadBotForCoexistence(
  tenantId: string,
  botId: string
): Promise<Bot | null> {
  return getBot(tenantId, botId);
}

export async function persistHistoryPayload(params: {
  bot: Bot;
  businessPhone: string;
  phoneNumberId: string;
  history: WhatsAppHistoryChunk[];
}): Promise<void> {
  const sortedChunks = [...params.history].sort((a, b) => {
    const phaseA = a.metadata?.phase ?? 0;
    const phaseB = b.metadata?.phase ?? 0;
    if (phaseA !== phaseB) return phaseA - phaseB;
    return (a.metadata?.chunk_order ?? 0) - (b.metadata?.chunk_order ?? 0);
  });

  for (const chunk of sortedChunks) {
    await persistCoexistenceHistoryChunk({
      bot: params.bot,
      businessPhone: params.businessPhone,
      phoneNumberId: params.phoneNumberId,
      chunk,
    });
  }
}

export async function persistMediaHistoryMessage(params: {
  bot: Bot;
  businessPhone: string;
  threadId: string;
  message: WhatsAppHistoryMessage;
}): Promise<void> {
  const conversation = await getOrCreateConversation(
    params.bot.tenantId,
    params.bot.botId,
    "whatsapp",
    params.threadId
  );

  const built = buildMessageFromHistory({
    tenantId: params.bot.tenantId,
    conversationId: conversation.conversationId,
    threadParticipantId: params.threadId,
    businessPhone: params.businessPhone,
    message: params.message,
    metadata: { mediaFollowUp: true },
  });

  await addMessageIdempotent(built, params.bot.botId, {
    updateCounters: false,
    updateLastMessageAt: false,
    publishRealtime: true,
  });
}
