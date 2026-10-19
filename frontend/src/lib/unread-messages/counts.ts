export function countUnreadConversations(counts: Record<string, number>): number {
  return Object.values(counts).reduce((total, value) => (value > 0 ? total + 1 : total), 0);
}

export function reconcileUnreadCounts(
  counts: Record<string, number>,
  conversations: Array<{ conversationId: string; workflowStatus?: string }>,
  activeConversationId: string | null,
  options?: { pruneUnknown?: boolean }
): Record<string, number> {
  const knownIds = new Set(conversations.map((conversation) => conversation.conversationId));
  const next: Record<string, number> = {};

  for (const [conversationId, value] of Object.entries(counts)) {
    if (value <= 0) continue;
    if (options?.pruneUnknown && !knownIds.has(conversationId)) continue;
    next[conversationId] = value;
  }

  for (const conversation of conversations) {
    if (conversation.workflowStatus !== "new") continue;
    if (conversation.conversationId === activeConversationId) continue;
    if ((next[conversation.conversationId] ?? 0) >= 1) continue;
    next[conversation.conversationId] = 1;
  }

  return next;
}

export function unreadCountsEqual(
  left: Record<string, number>,
  right: Record<string, number>
): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  for (const key of leftKeys) {
    if (left[key] !== right[key]) return false;
  }
  return true;
}
