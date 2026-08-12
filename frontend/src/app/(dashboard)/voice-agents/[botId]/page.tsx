"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { VoiceAgentCallsTable } from "@/components/voice-agents/VoiceAgentCallsTable";
import { VoiceAgentDialpad } from "@/components/voice-agents/VoiceAgentDialpad";
import { VoiceAgentSettings } from "@/components/voice-agents/VoiceAgentSettings";
import { VoiceAgentStructuredOutputsPanel } from "@/components/voice-agents/VoiceAgentStructuredOutputsPanel";
import { VoiceAgentBotIdCopy } from "@/components/voice-agents/VoiceAgentBotIdCopy";
import { VoiceAgentSummary } from "@/components/voice-agents/VoiceAgentSummary";
import { VoiceAgentWebhookPanel } from "@/components/voice-agents/VoiceAgentWebhookPanel";
import { useBot } from "@/hooks/useBots";
import { useT } from "@/i18n/context";

const TABS = ["overview", "config", "structuredOutputs", "calls", "webhooks", "test"] as const;
type TabId = (typeof TABS)[number];

function isTabId(value: string | null): value is TabId {
  return TABS.includes(value as TabId);
}

export default function VoiceAgentDetailPage() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { botId } = useParams<{ botId: string }>();
  const { data: bot, isLoading } = useBot(botId);

  const tab = useMemo<TabId>(() => {
    const value = searchParams.get("tab");
    return isTabId(value) ? value : "overview";
  }, [searchParams]);

  function setTab(next: TabId) {
    router.replace(`/voice-agents/${botId}?tab=${next}`);
  }

  if (isLoading) {
    return (
      <DashboardPage>
        <div className="h-40 animate-pulse rounded-xl bg-surface-muted" />
      </DashboardPage>
    );
  }

  if (!bot) {
    return (
      <DashboardPage>
        <p className="text-sm text-secondary">{t("bots.loadError")}</p>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage maxWidth="6xl" className="space-y-6">
      <Link
        href="/voice-agents"
        className="mb-2 flex items-center gap-1 text-sm text-secondary hover:text-primary"
      >
        <ChevronLeft className="h-4 w-4" />
        {t("voiceAgents.backToList")}
      </Link>

      <PageHeader
        title={t("voiceAgents.manageTitle", { name: bot.name })}
        subtitle={t("voiceAgents.manageSubtitle")}
      />

      <VoiceAgentBotIdCopy botId={botId} />

      <div className="flex flex-wrap gap-2 border-b border-default pb-2">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === item
                ? "bg-accent text-white"
                : "text-secondary hover:bg-surface-muted hover:text-primary"
            }`}
          >
            {t(`voiceAgents.tab.${item}`)}
          </button>
        ))}
      </div>

      {tab === "overview" && <VoiceAgentSummary botId={botId} />}
      {tab === "config" && <VoiceAgentSettings botId={botId} />}
      {tab === "structuredOutputs" && <VoiceAgentStructuredOutputsPanel botId={botId} />}
      {tab === "calls" && <VoiceAgentCallsTable botId={botId} />}
      {tab === "webhooks" && <VoiceAgentWebhookPanel botId={botId} />}
      {tab === "test" && <VoiceAgentDialpad botId={botId} />}
    </DashboardPage>
  );
}
