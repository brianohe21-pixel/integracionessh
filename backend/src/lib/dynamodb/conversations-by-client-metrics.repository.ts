import type { Conversation, Message } from "../../types/index.js";
import {
  classifyWhatsAppMessageWindow,
  resolveWhatsAppMessageWindowDirection,
  shouldOpenFreeEntryPoint,
} from "../whatsapp/messaging-windows.js";
import { isWithinDateRange, resolveMetricsDateRange } from "./call-metrics.js";
import { getAllConversationMessages } from "./conversation.repository.js";
import { listAllConversationsForTenant } from "./metrics.repository.js";

export const SERVICE_MESSAGES_QUOTA = 1000;
const MESSAGE_FETCH_CONCURRENCY = 8;

export interface ConversationsByClientRow {
  clientKey: string;
  clientName?: string;
  conversations: number;
  aiUsage: number;
  serviceMessagesUsed: number;
  serviceMessagesQuota: number;
  inbound: number;
  outbound: number;
}

export interface ConversationsByClientTotals {
  conversations: number;
  aiUsage: number;
  serviceMessagesUsed: number;
  inbound: number;
  outbound: number;
}

export interface ConversationsByClientReport {
  from: string;
  to: string;
  botId?: string;
  serviceMessagesQuota: number;
  rows: ConversationsByClientRow[];
  totals: ConversationsByClientTotals;
}

type ClientAccumulator = {
  clientName?: string;
  latestNameAt: string;
  conversationIds: Set<string>;
  aiUsage: number;
  serviceMessagesUsed: number;
  inbound: number;
  outbound: number;
};

type ConversationClientStats = {
  clientKey: string;
  clientName?: string;
  nameAt: string;
  conversationId: string;
  aiUsage: number;
  serviceMessagesUsed: number;
  inbound: number;
  outbound: number;
};

function resolveMessageDirection(
  message: Pick<Message, "channel" | "source" | "role">
): "inbound" | "outbound" | null {
  const whatsappDirection = resolveWhatsAppMessageWindowDirection(message);
  if (whatsappDirection) return whatsappDirection;
  if ((message.channel ?? "whatsapp") === "whatsapp") return null;
  if (message.role === "user") return "inbound";
  if (message.role === "assistant" || message.role === "advisor" || message.role === "system") {
    return "outbound";
  }
  return null;
}

function conversationMayHaveMessagesInRange(
  conversation: Conversation,
  from: string
): boolean {
  if ((conversation.messageCount ?? 0) <= 0) return false;
  const rangeStart = `${from}T00:00:00.000Z`;
  return conversation.lastMessageAt >= rangeStart;
}

export function summarizeConversationForClientReport(params: {
  conversation: Conversation;
  messages: Message[];
  from: string;
  to: string;
}): ConversationClientStats | null {
  const { conversation, messages, from, to } = params;
  const clientKey = conversation.phoneNumber ?? conversation.participantId;
  if (!clientKey) return null;

  const sorted = [...messages].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  let lastInboundAt: string | undefined;
  let freeEntryPointOpenedAt: string | undefined;
  let aiUsage = 0;
  let serviceMessagesUsed = 0;
  let inbound = 0;
  let outbound = 0;
  let hadActivityInRange = false;

  for (const message of sorted) {
    const atMs = Date.parse(message.timestamp);
    if (!Number.isFinite(atMs)) continue;

    const direction = resolveMessageDirection(message);
    const inRange = isWithinDateRange(message.timestamp, from, to);

    if (direction && inRange) {
      hadActivityInRange = true;
      if (direction === "inbound") inbound += 1;
      else outbound += 1;
      if (message.role === "assistant") aiUsage += 1;

      if ((message.channel ?? "whatsapp") === "whatsapp") {
        const opensFreeEntryPoint =
          direction === "outbound" &&
          shouldOpenFreeEntryPoint(
            {
              createdAt: conversation.createdAt,
              ...(conversation.attribution
                ? { attribution: conversation.attribution }
                : {}),
              ...(freeEntryPointOpenedAt ? { freeEntryPointOpenedAt } : {}),
            },
            message.timestamp
          );

        const bucket = classifyWhatsAppMessageWindow({
          direction,
          atMs,
          conversation: {
            ...(lastInboundAt ? { lastInboundAt } : {}),
            ...(freeEntryPointOpenedAt ? { freeEntryPointOpenedAt } : {}),
          },
          opensFreeEntryPoint,
        });

        if (bucket === "outboundService24h") {
          serviceMessagesUsed += 1;
        }

        if (opensFreeEntryPoint && !freeEntryPointOpenedAt) {
          freeEntryPointOpenedAt = message.timestamp;
        }
      }
    } else if (inRange && message.role === "assistant") {
      hadActivityInRange = true;
      aiUsage += 1;
    }

    if (direction === "inbound") {
      lastInboundAt = message.timestamp;
    }
  }

  if (!hadActivityInRange) return null;

  return {
    clientKey,
    ...(conversation.contactName ? { clientName: conversation.contactName } : {}),
    nameAt: conversation.lastMessageAt ?? conversation.createdAt ?? "",
    conversationId: conversation.conversationId,
    aiUsage,
    serviceMessagesUsed,
    inbound,
    outbound,
  };
}

function mergeClientStats(
  byClient: Map<string, ClientAccumulator>,
  stats: ConversationClientStats
): void {
  const current = byClient.get(stats.clientKey) ?? {
    latestNameAt: "",
    conversationIds: new Set<string>(),
    aiUsage: 0,
    serviceMessagesUsed: 0,
    inbound: 0,
    outbound: 0,
  };

  current.conversationIds.add(stats.conversationId);
  current.aiUsage += stats.aiUsage;
  current.serviceMessagesUsed += stats.serviceMessagesUsed;
  current.inbound += stats.inbound;
  current.outbound += stats.outbound;

  if (stats.clientName && stats.nameAt >= current.latestNameAt) {
    current.clientName = stats.clientName;
    current.latestNameAt = stats.nameAt;
  }

  byClient.set(stats.clientKey, current);
}

export function assembleConversationsByClientReport(
  statsList: ConversationClientStats[],
  range: { from: string; to: string },
  botId?: string
): ConversationsByClientReport {
  const byClient = new Map<string, ClientAccumulator>();
  for (const stats of statsList) {
    mergeClientStats(byClient, stats);
  }

  const rows: ConversationsByClientRow[] = [...byClient.entries()]
    .map(([clientKey, stats]) => ({
      clientKey,
      ...(stats.clientName ? { clientName: stats.clientName } : {}),
      conversations: stats.conversationIds.size,
      aiUsage: stats.aiUsage,
      serviceMessagesUsed: stats.serviceMessagesUsed,
      serviceMessagesQuota: SERVICE_MESSAGES_QUOTA,
      inbound: stats.inbound,
      outbound: stats.outbound,
    }))
    .sort(
      (a, b) =>
        b.conversations - a.conversations ||
        b.outbound - a.outbound ||
        a.clientKey.localeCompare(b.clientKey)
    );

  const totals = rows.reduce<ConversationsByClientTotals>(
    (sum, row) => ({
      conversations: sum.conversations + row.conversations,
      aiUsage: sum.aiUsage + row.aiUsage,
      serviceMessagesUsed: sum.serviceMessagesUsed + row.serviceMessagesUsed,
      inbound: sum.inbound + row.inbound,
      outbound: sum.outbound + row.outbound,
    }),
    {
      conversations: 0,
      aiUsage: 0,
      serviceMessagesUsed: 0,
      inbound: 0,
      outbound: 0,
    }
  );

  return {
    from: range.from,
    to: range.to,
    ...(botId ? { botId } : {}),
    serviceMessagesQuota: SERVICE_MESSAGES_QUOTA,
    rows,
    totals,
  };
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function run(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index]);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => run());
  await Promise.all(workers);
  return results;
}

export async function getConversationsByClientReport(
  tenantId: string,
  options: { from?: string; to?: string; days?: number; botId?: string } = {}
): Promise<ConversationsByClientReport> {
  const range = resolveMetricsDateRange(options);
  const botId = options.botId?.trim();
  const conversations = await listAllConversationsForTenant(tenantId, botId);
  const candidates = conversations.filter((conversation) =>
    conversationMayHaveMessagesInRange(conversation, range.from)
  );

  const statsList = (
    await mapPool(candidates, MESSAGE_FETCH_CONCURRENCY, async (conversation) => {
      const messages = await getAllConversationMessages(tenantId, conversation.conversationId);
      return summarizeConversationForClientReport({
        conversation,
        messages,
        from: range.from,
        to: range.to,
      });
    })
  ).filter((stats): stats is ConversationClientStats => stats !== null);

  return assembleConversationsByClientReport(statsList, range, botId);
}
