"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Braces,
  ChevronLeft,
  LayoutDashboard,
  PhoneCall,
  Settings,
  Webhook,
  Wrench,
  Workflow,
} from "lucide-react";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
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
import { VoiceAgentSideNav } from "@/components/voice-agents/VoiceAgentSideNav";
import { useBot } from "@/hooks/useBots";
import { useT } from "@/i18n/context";

const TABS = ["overview", "flow", "config", "tools", "structuredOutputs", "calls", "webhooks", "test"] as const;
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

  const tabs = useMemo(
    () =>
      [
        {
          id: "overview" as const,
          label: t("voiceAgents.tab.overview"),
          icon: <LayoutDashboard className="h-4 w-4" />,
        },
        {
          id: "flow" as const,
          label: t("voiceAgents.tab.flow"),
          icon: <Workflow className="h-4 w-4" />,
        },
        {
          id: "config" as const,
          label: t("voiceAgents.tab.config"),
          icon: <Settings className="h-4 w-4" />,
        },
        {
          id: "tools" as const,
          label: t("voiceAgents.tab.tools"),
          icon: <Wrench className="h-4 w-4" />,
        },
        {
          id: "structuredOutputs" as const,
          label: t("voiceAgents.tab.structuredOutputs"),
          icon: <Braces className="h-4 w-4" />,
        },
        {
          id: "calls" as const,
          label: t("voiceAgents.tab.calls"),
          icon: <PhoneCall className="h-4 w-4" />,
        },
        {
          id: "webhooks" as const,
          label: t("voiceAgents.tab.webhooks"),
          icon: <Webhook className="h-4 w-4" />,
        },
        {
          id: "test" as const,
          label: t("voiceAgents.tab.test"),
          icon: <PhoneCall className="h-4 w-4" />,
        },
      ] satisfies Array<{ id: TabId; label: string; icon: ReactNode }>,
    [t]
  );

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

      <VoiceAgentSetupChecklist botId={botId} />

      <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <VoiceAgentSideNav
          tabs={tabs}
          activeTab={tab}
          onSelect={setTab}
          sectionTitle={bot.name}
          sectionSubtitle={t("voiceAgents.manageSubtitle")}
        />

        <div className="min-w-0">
          {tab === "overview" && <VoiceAgentSummary botId={botId} />}
          {tab === "flow" && <VoiceAgentFlowPanel botId={botId} />}
          {tab === "config" && <VoiceAgentSettings botId={botId} />}
          {tab === "tools" && <VoiceAgentToolsPanel botId={botId} />}
          {tab === "structuredOutputs" && <VoiceAgentStructuredOutputsPanel botId={botId} />}
          {tab === "calls" && <VoiceAgentCallsTable botId={botId} />}
          {tab === "webhooks" && <VoiceAgentWebhookPanel botId={botId} />}
          {tab === "test" && <VoiceAgentDialpad botId={botId} />}
        </div>
      </div>
    </DashboardPage>
  );
}
