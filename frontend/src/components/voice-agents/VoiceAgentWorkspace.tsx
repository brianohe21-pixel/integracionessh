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
    return <div className="h-56 animate-pulse rounded-xl bg-surface-muted" />;
  }

  if (!bot) {
    return <p className="text-sm text-secondary">{t("bots.loadError")}</p>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="content-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-default px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-secondary hover:bg-surface-muted hover:text-primary lg:hidden"
              >
                <ChevronLeft className="h-4 w-4" />
                {t("voiceAgents.backToList")}
              </button>
            ) : null}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-primary">{bot.name}</p>
              <p className="truncate text-xs text-secondary">{t("voiceAgents.manageSubtitle")}</p>
            </div>
          </div>
          <div className="lg:hidden">
            <VoiceAgentBotIdCopy botId={botId} compact />
          </div>
        </div>
      </div>

      <VoiceAgentSetupChecklist botId={botId} />

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <VoiceAgentSideNav
          tabs={tabs}
          activeTab={section}
          onSelect={onSectionChange}
          sectionTitle={bot.name}
          sectionSubtitle={t("voiceAgents.workspaceNavSubtitle")}
        />

        <div className="min-h-0 min-w-0 overflow-y-auto pb-6">
          {section === "overview" ? <VoiceAgentSummary botId={botId} /> : null}
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
