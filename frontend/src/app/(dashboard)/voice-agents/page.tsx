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
    <DashboardPage className="space-y-6">
      <PageHeader title={t("voiceAgents.title")} subtitle={t("voiceAgents.subtitle")} />

      <div className="min-w-0">
        {pageTab === "agents" ? (
          <div className="grid min-h-[calc(100vh-12rem)] gap-4 xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
            <div className={showWorkspace ? "hidden xl:block" : "block"}>
              <VoiceAgentListPanel
                bots={filteredBots}
                selectedBotId={selectedAgentId || null}
                onSelect={selectAgent}
                search={search}
                onSearchChange={setSearch}
                isLoading={isLoading}
              />
            </div>

            <div className={showWorkspace ? "block min-h-0" : "hidden xl:block"}>
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
