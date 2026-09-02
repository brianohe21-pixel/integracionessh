"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PhoneCall } from "lucide-react";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { VoiceAgentListPanel } from "@/components/voice-agents/VoiceAgentListPanel";
import { VoiceAgentPhoneNumbersPanel } from "@/components/voice-agents/VoiceAgentPhoneNumbersPanel";
import { VoiceAgentWorkspace } from "@/components/voice-agents/VoiceAgentWorkspace";
import { useBots } from "@/hooks/useBots";
import { useT } from "@/i18n/context";
import {
  isVoiceAgentDetailTab,
  type VoiceAgentDetailTabId,
} from "@/lib/voice-agent-sections";
import { cn } from "@/lib/utils";

const PAGE_TABS = ["agents", "phoneNumbers"] as const;
type PageTabId = (typeof PAGE_TABS)[number];

function isPageTabId(value: string | null): value is PageTabId {
  return PAGE_TABS.includes(value as PageTabId);
}

export default function VoiceAgentsPage() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: botsData, isLoading } = useBots();
  const [search, setSearch] = useState("");
  const bots = useMemo(() => botsData ?? [], [botsData]);

  const pageTab = useMemo<PageTabId>(() => {
    const value = searchParams.get("tab");
    return isPageTabId(value) ? value : "agents";
  }, [searchParams]);

  const selectedAgentId = searchParams.get("agent") ?? "";
  const section = useMemo<VoiceAgentDetailTabId>(() => {
    const value = searchParams.get("section");
    return isVoiceAgentDetailTab(value) ? value : "overview";
  }, [searchParams]);

  const urlBotId = searchParams.get("botId") ?? "";
  const [numbersBotId, setNumbersBotId] = useState("");

  useEffect(() => {
    if (urlBotId) setNumbersBotId(urlBotId);
  }, [urlBotId]);

  const effectiveNumbersBotId = numbersBotId || urlBotId || selectedAgentId || bots[0]?.botId || "";

  const filteredBots = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return bots;
    return bots.filter(
      (bot) =>
        bot.name.toLowerCase().includes(query) ||
        (bot.telephonyPhoneNumber ?? "").includes(query)
    );
  }, [bots, search]);

  function replaceParams(mutator: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutator(params);
    const query = params.toString();
    router.replace(query ? `/voice-agents?${query}` : "/voice-agents");
  }

  function selectAgent(botId: string) {
    replaceParams((params) => {
      params.delete("tab");
      params.delete("botId");
      params.set("agent", botId);
      if (!params.get("section")) params.set("section", "overview");
    });
  }

  function clearAgent() {
    replaceParams((params) => {
      params.delete("agent");
      params.delete("section");
    });
  }

  function setSection(next: VoiceAgentDetailTabId) {
    if (!selectedAgentId) return;
    replaceParams((params) => {
      params.set("agent", selectedAgentId);
      params.set("section", next);
    });
  }

  function handleNumbersBotChange(botId: string) {
    setNumbersBotId(botId);
    replaceParams((params) => {
      params.set("tab", "phoneNumbers");
      params.set("botId", botId);
      params.delete("agent");
      params.delete("section");
    });
  }

  const showWorkspace = pageTab === "agents" && Boolean(selectedAgentId);

  return (
    <DashboardPage className="flex min-h-0 flex-1 flex-col gap-3">
      <PageHeader
        title={t("voiceAgents.title")}
        subtitle={showWorkspace ? undefined : t("voiceAgents.subtitle")}
        className="mb-0 shrink-0"
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {pageTab === "agents" ? (
          <div className="grid h-full min-h-[calc(100vh-9.5rem)] gap-3 xl:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
            <div className={cn("min-h-0", showWorkspace ? "hidden xl:flex xl:flex-col" : "flex flex-col")}>
              <VoiceAgentListPanel
                bots={filteredBots}
                selectedBotId={selectedAgentId || null}
                onSelect={selectAgent}
                search={search}
                onSearchChange={setSearch}
                isLoading={isLoading}
              />
            </div>

            <div className={cn("min-h-0", showWorkspace ? "flex flex-col" : "hidden xl:flex xl:flex-col")}>
              {showWorkspace ? (
                <VoiceAgentWorkspace
                  botId={selectedAgentId}
                  section={section}
                  onSectionChange={setSection}
                  onBack={clearAgent}
                  bots={bots}
                />
              ) : (
                <EmptyState
                  icon={<PhoneCall className="h-5 w-5" />}
                  title={t("voiceAgents.selectAgentTitle")}
                  description={t("voiceAgents.selectAgentPrompt")}
                />
              )}
            </div>
          </div>
        ) : null}

        {pageTab === "phoneNumbers" ? (
          <VoiceAgentPhoneNumbersPanel
            botId={effectiveNumbersBotId}
            bots={bots}
            onBotChange={handleNumbersBotChange}
          />
        ) : null}
      </div>
    </DashboardPage>
  );
}
