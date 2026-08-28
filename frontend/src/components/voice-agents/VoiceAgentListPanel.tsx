"use client";

import { PhoneCall } from "lucide-react";
import { SearchInput } from "@/components/ui/SearchInput";
import { VoiceAgentBotIdCopy } from "@/components/voice-agents/VoiceAgentBotIdCopy";
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
        "w-full rounded-xl border px-3 py-3 text-left transition-colors",
        selected
          ? "border-accent/40 bg-accent-muted/60 shadow-sm"
          : "border-default bg-surface-elevated hover:border-accent/20 hover:bg-surface-muted/40"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            active ? "bg-emerald-500/15 text-emerald-600" : "bg-surface-muted text-muted"
          )}
        >
          <PhoneCall className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-medium text-primary">{bot.name}</p>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                active ? "bg-emerald-500/15 text-emerald-700" : "bg-surface-muted text-secondary"
              )}
            >
              {active ? t("common.active") : t("common.inactive")}
            </span>
          </div>
          <p className="mt-1 truncate text-xs text-secondary">
            {bot.telephonyPhoneNumber || t("voiceAgents.noNumber")}
          </p>
          {recentCalls > 0 ? (
            <p className="mt-1 text-[11px] text-muted">
              {recentCalls} {t("voiceAgents.recentCalls")}
            </p>
          ) : null}
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
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="content-card overflow-hidden">
        <div className="section-header">
          <span className="section-header-title">{t("voiceAgents.listTitle")}</span>
          <span className="section-header-subtitle">{t("voiceAgents.listSubtitle")}</span>
        </div>
        <div className="space-y-3 p-4">
          <SearchInput
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            onClear={() => onSearchChange("")}
            placeholder={t("voiceAgents.searchPlaceholder")}
          />
          {isLoading ? (
            <div className="space-y-2">
              <div className="h-20 animate-pulse rounded-xl bg-surface-muted" />
              <div className="h-20 animate-pulse rounded-xl bg-surface-muted" />
            </div>
          ) : bots.length === 0 ? (
            <p className="text-sm text-secondary">{t("voiceAgents.empty")}</p>
          ) : (
            <div className="max-h-[calc(100vh-18rem)] space-y-2 overflow-y-auto pr-1">
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

      {selectedBotId ? (
        <div className="hidden lg:block">
          <VoiceAgentBotIdCopy botId={selectedBotId} />
        </div>
      ) : null}
    </div>
  );
}
