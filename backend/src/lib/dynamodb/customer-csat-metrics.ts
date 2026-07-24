import type { Conversation, CustomerCsatMetrics } from "../../types/index.js";
import { isWithinDateRange } from "./call-metrics.js";

function csatTimestamp(conversation: Conversation): string | undefined {
  return conversation.csatSubmittedAt ?? conversation.resolvedAt;
}

function isValidCsat(score: number | undefined): score is number {
  return score !== undefined && score >= 1 && score <= 5;
}

export interface BuildCustomerCsatRollupOptions {
  range?: { from: string; to: string };
  limit?: number;
}

export function buildCustomerCsatRollup(
  conversations: Conversation[],
  options: BuildCustomerCsatRollupOptions = {}
): CustomerCsatMetrics[] {
  const { range, limit } = options;

  const byPhone = new Map<
    string,
    {
      contactName?: string;
      latestNameAt: string;
      sum: number;
      count: number;
    }
  >();

  for (const conversation of conversations) {
    if (!isValidCsat(conversation.csatScore)) continue;

    const timestamp = csatTimestamp(conversation);
    if (range) {
      if (!timestamp || !isWithinDateRange(timestamp, range.from, range.to)) {
        continue;
      }
    }

    const phone = conversation.phoneNumber ?? conversation.participantId;
    if (!phone) continue;

    const current = byPhone.get(phone) ?? {
      latestNameAt: "",
      sum: 0,
      count: 0,
    };

    const nameAt = timestamp ?? conversation.lastMessageAt ?? "";
    if (conversation.contactName && nameAt >= current.latestNameAt) {
      current.contactName = conversation.contactName;
      current.latestNameAt = nameAt;
    }

    current.sum += conversation.csatScore;
    current.count += 1;
    byPhone.set(phone, current);
  }

  const results: CustomerCsatMetrics[] = [...byPhone.entries()]
    .map(([contactPhone, stats]) => ({
      contactPhone,
      ...(stats.contactName ? { contactName: stats.contactName } : {}),
      averageCsat: Math.round((stats.sum / stats.count) * 10) / 10,
      ratingCount: stats.count,
    }))
    .sort((a, b) => b.averageCsat - a.averageCsat || b.ratingCount - a.ratingCount);

  return limit !== undefined ? results.slice(0, limit) : results;
}

export function buildCustomerCsatMap(
  conversations: Conversation[]
): Map<string, { averageCsat: number; ratingCount: number }> {
  const rollup = buildCustomerCsatRollup(conversations);
  return new Map(
    rollup.map((entry) => [
      entry.contactPhone,
      { averageCsat: entry.averageCsat, ratingCount: entry.ratingCount },
    ])
  );
}
