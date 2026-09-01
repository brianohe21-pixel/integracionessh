import { resolveMetricsDateRange } from "./call-metrics.js";
import { listAllConversationsForTenant } from "./metrics.repository.js";
import {
  INTERACTION_CATEGORIES,
  type Conversation,
  type ConversationCategoryMetrics,
  type InteractionCategory,
} from "../../types/index.js";

function isInRange(iso: string, from: string, to: string): boolean {
  const time = new Date(iso).getTime();
  return time >= new Date(from).getTime() && time <= new Date(`${to}T23:59:59.999Z`).getTime();
}

function conversationActivityAt(conversation: Conversation): string {
  return conversation.resolvedAt ?? conversation.lastMessageAt ?? conversation.createdAt;
}

export async function getConversationCategoryMetrics(
  tenantId: string,
  options: { from?: string; to?: string; days?: number; botId?: string } = {}
): Promise<ConversationCategoryMetrics> {
  const range = resolveMetricsDateRange(options);
  const botId = options.botId?.trim();
  const conversations = await listAllConversationsForTenant(tenantId, botId);

  const counts = new Map<InteractionCategory | "uncategorized", number>();
  for (const category of INTERACTION_CATEGORIES) {
    counts.set(category, 0);
  }
  counts.set("uncategorized", 0);

  let total = 0;
  let categorized = 0;

  for (const conversation of conversations) {
    if ((conversation.handoffMode ?? "bot") !== "human") continue;
    const activityAt = conversationActivityAt(conversation);
    if (!isInRange(activityAt, range.from, range.to)) continue;

    total += 1;
    const category = conversation.interactionCategory ?? "uncategorized";
    counts.set(category, (counts.get(category) ?? 0) + 1);
    if (category !== "uncategorized") categorized += 1;
  }

  const byCategory = [
    ...INTERACTION_CATEGORIES.map((category) => ({
      category,
      count: counts.get(category) ?? 0,
    })),
    {
      category: "uncategorized" as const,
      count: counts.get("uncategorized") ?? 0,
    },
  ].filter((row) => row.count > 0);

  return {
    from: range.from,
    to: range.to,
    total,
    categorized,
    uncategorized: counts.get("uncategorized") ?? 0,
    byCategory,
  };
}
