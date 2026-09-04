"use client";

import type { MessageReaction } from "@/types";
import { cn } from "@/lib/utils";

type Props = {
  reactions?: MessageReaction[];
  align: "left" | "right";
};

function groupReactions(reactions: MessageReaction[]): Array<{ emoji: string; count: number }> {
  const groups = new Map<string, number>();
  for (const reaction of reactions) {
    if (!reaction.emoji) continue;
    groups.set(reaction.emoji, (groups.get(reaction.emoji) ?? 0) + 1);
  }
  return [...groups.entries()].map(([emoji, count]) => ({ emoji, count }));
}

export function MessageReactions({ reactions, align }: Props) {
  const grouped = groupReactions(reactions ?? []);
  if (grouped.length === 0) return null;

  return (
    <div
      className={cn(
        "mt-1 flex flex-wrap gap-1",
        align === "left" ? "justify-start" : "justify-end"
      )}
    >
      {grouped.map(({ emoji, count }) => (
        <span
          key={emoji}
          className="inline-flex items-center gap-0.5 rounded-full border border-border/60 bg-surface px-1.5 py-0.5 text-xs shadow-sm"
        >
          <span className="emoji-text leading-none">{emoji}</span>
          {count > 1 ? <span className="text-[10px] text-muted">{count}</span> : null}
        </span>
      ))}
    </div>
  );
}
