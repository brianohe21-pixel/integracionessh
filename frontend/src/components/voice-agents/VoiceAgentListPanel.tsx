"use client";

import { PhoneCall } from "lucide-react";
import { SearchInput } from "@/components/ui/SearchInput";
import { useTelephonyCalls } from "@/hooks/useTelephony";
import { useT } from "@/i18n/context";
import type { Bot } from "@/types";
import { cn } from "@/lib/utils";

function VoiceAgentListCard({
  bot,
  selected,
  onSelect,
}: {
  bot: Bot;
  selected: boolean;
  onSelect: () => void;
}) {
  const t = useT();
  const { data } = useTelephonyCalls(bot.botId);
  const recentCalls = data?.items?.length ?? 0;
  const active = Boolean(bot.telephonyEnabled);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-lg border px-2.5 py-2 text-left transition-colors",
        selected
          ? "border-accent/40 bg-accent-muted/60"
          : "border-default bg-surface-elevated hover:border-accent/20 hover:bg-surface-muted/40"
      )}
    >
      <div className="flex items-center gap-2.5">
        <div
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
            active ? "bg-emerald-500/15 text-emerald-600" : "bg-surface-muted text-muted"
          )}
        >
          <PhoneCall className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-medium text-primary">{bot.name}</p>
            <span
              className={cn(
                "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase",
                active ? "bg-emerald-500/15 text-emerald-700" : "bg-surface-muted text-secondary"
              )}
            >
              {active ? t("common.active") : t("common.inactive")}
            </span>
          </div>
          <p className="truncate text-[11px] text-secondary">
            {bot.telephonyPhoneNumber || t("voiceAgents.noNumber")}
            {recentCalls > 0 ? ` · ${recentCalls} ${t("voiceAgents.recentCalls")}` : ""}
          </p>
        </div>
      </div>
    </button>
  );
}

interface VoiceAgentListPanelProps {
  bots: Bot[];
  selectedBotId: string | null;
  onSelect: (botId: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  isLoading?: boolean;
}

export function VoiceAgentListPanel({
  bots,
  selectedBotId,
  onSelect,
  search,
  onSearchChange,
  isLoading = false,
}: VoiceAgentListPanelProps) {
  const t = useT();

  return (
    <div className="content-card flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 space-y-2 border-b border-default p-3">
        <p className="text-xs font-semibold text-primary">{t("voiceAgents.listTitle")}</p>
        <SearchInput
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          onClear={() => onSearchChange("")}
          placeholder={t("voiceAgents.searchPlaceholder")}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-14 animate-pulse rounded-lg bg-surface-muted" />
            <div className="h-14 animate-pulse rounded-lg bg-surface-muted" />
          </div>
        ) : bots.length === 0 ? (
          <p className="px-1 py-2 text-sm text-secondary">{t("voiceAgents.empty")}</p>
        ) : (
          <div className="space-y-1.5">
            {bots.map((bot) => (
              <VoiceAgentListCard
                key={bot.botId}
                bot={bot}
                selected={selectedBotId === bot.botId}
                onSelect={() => onSelect(bot.botId)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
