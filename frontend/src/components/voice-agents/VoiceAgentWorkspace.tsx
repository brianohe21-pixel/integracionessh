"use client";

import { ChevronLeft } from "lucide-react";
import { VoiceAgentCallsTable } from "@/components/voice-agents/VoiceAgentCallsTable";
import { VoiceAgentDialpad } from "@/components/voice-agents/VoiceAgentDialpad";
import { VoiceAgentSettings } from "@/components/voice-agents/VoiceAgentSettings";
import { VoiceAgentStructuredOutputsPanel } from "@/components/voice-agents/VoiceAgentStructuredOutputsPanel";
import { VoiceAgentBotIdCopy } from "@/components/voice-agents/VoiceAgentBotIdCopy";
import { VoiceAgentFlowPanel } from "@/components/voice-agents/VoiceAgentFlowPanel";
import { VoiceAgentSetupChecklist } from "@/components/voice-agents/VoiceAgentSetupChecklist";
import { VoiceAgentSummary } from "@/components/voice-agents/VoiceAgentSummary";
import { VoiceAgentToolsPanel } from "@/components/voice-agents/VoiceAgentToolsPanel";
import { VoiceAgentWebhookPanel } from "@/components/voice-agents/VoiceAgentWebhookPanel";
import { VoiceAgentPhoneNumbersPanel } from "@/components/voice-agents/VoiceAgentPhoneNumbersPanel";
import { VoiceAgentSideNav } from "@/components/voice-agents/VoiceAgentSideNav";
import { useBot } from "@/hooks/useBots";
import { useT } from "@/i18n/context";
import { cn } from "@/lib/utils";
import type { VoiceAgentDetailTabId } from "@/lib/voice-agent-sections";
import { useVoiceAgentDetailTabs } from "@/lib/voice-agent-sections";
import type { Bot } from "@/types";

interface VoiceAgentWorkspaceProps {
  botId: string;
  section: VoiceAgentDetailTabId;
  onSectionChange: (section: VoiceAgentDetailTabId) => void;
  onBack?: () => void;
  bots?: Bot[];
}

export function VoiceAgentWorkspace({
  botId,
  section,
  onSectionChange,
  onBack,
  bots,
}: VoiceAgentWorkspaceProps) {
  const t = useT();
  const tabs = useVoiceAgentDetailTabs();
  const { data: bot, isLoading } = useBot(botId);

  if (isLoading) {
    return <div className="h-full min-h-[20rem] animate-pulse rounded-xl bg-surface-muted" />;
  }

  if (!bot) {
    return <p className="text-sm text-secondary">{t("bots.loadError")}</p>;
  }

  const active = Boolean(bot.telephonyEnabled);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="content-card flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-default px-3 py-2.5 sm:px-4">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1 rounded-lg p-1.5 text-secondary hover:bg-surface-muted hover:text-primary xl:hidden"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="text-sm">{t("voiceAgents.backToList")}</span>
            </button>
          ) : null}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-sm font-semibold text-primary sm:text-base">{bot.name}</h2>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                  active ? "bg-emerald-500/15 text-emerald-700" : "bg-surface-muted text-secondary"
                )}
              >
                {active ? t("common.active") : t("common.inactive")}
              </span>
              {bot.telephonyPhoneNumber ? (
                <span className="truncate text-xs text-secondary">{bot.telephonyPhoneNumber}</span>
              ) : null}
            </div>
          </div>

          <VoiceAgentBotIdCopy botId={botId} compact />
        </div>

        <div className="shrink-0 border-b border-default px-3 py-2 sm:px-4">
          <VoiceAgentSideNav
            tabs={tabs}
            activeTab={section}
            onSelect={onSectionChange}
            variant="horizontal"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          <VoiceAgentSetupChecklist botId={botId} compact />

          {section === "overview" ? <VoiceAgentSummary botId={botId} compact /> : null}
          {section === "flow" ? <VoiceAgentFlowPanel botId={botId} /> : null}
          {section === "config" ? <VoiceAgentSettings botId={botId} /> : null}
          {section === "numbers" ? (
            <VoiceAgentPhoneNumbersPanel botId={botId} bots={bots} />
          ) : null}
          {section === "tools" ? <VoiceAgentToolsPanel botId={botId} /> : null}
          {section === "structuredOutputs" ? (
            <VoiceAgentStructuredOutputsPanel botId={botId} />
          ) : null}
          {section === "calls" ? <VoiceAgentCallsTable botId={botId} /> : null}
          {section === "webhooks" ? <VoiceAgentWebhookPanel botId={botId} /> : null}
          {section === "test" ? <VoiceAgentDialpad botId={botId} /> : null}
        </div>
      </div>
    </div>
  );
}
