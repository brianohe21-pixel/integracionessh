"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Hash, PhoneCall, Settings2, Users } from "lucide-react";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/ui/SearchInput";
import { useBots } from "@/hooks/useBots";
import { useTelephonyCalls } from "@/hooks/useTelephony";
import { VoiceAgentBotIdCopy } from "@/components/voice-agents/VoiceAgentBotIdCopy";
import { VoiceAgentPhoneNumbersPanel } from "@/components/voice-agents/VoiceAgentPhoneNumbersPanel";
import { VoiceAgentSideNav } from "@/components/voice-agents/VoiceAgentSideNav";
import { useT } from "@/i18n/context";
import type { Bot } from "@/types";

const TABS = ["agents", "phoneNumbers"] as const;
type TabId = (typeof TABS)[number];

function isTabId(value: string | null): value is TabId {
  return TABS.includes(value as TabId);
}

function VoiceAgentListItem({ bot }: { bot: Bot }) {
  const t = useT();
  const { data } = useTelephonyCalls(bot.botId);
  const recentCalls = data?.items?.length ?? 0;
  const lastCost = data?.items?.[0]?.costBreakdown?.totalUsd;

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <PhoneCall className="h-4 w-4 text-accent" />
          <p className="font-medium text-primary">{bot.name}</p>
          <VoiceAgentBotIdCopy botId={bot.botId} compact />
          {bot.telephonyEnabled ? (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
              {t("common.active")}
            </span>
          ) : (
            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-secondary">
              {t("common.inactive")}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-secondary">
          {bot.telephonyPhoneNumber || t("voiceAgents.noNumber")}
          {recentCalls > 0 && ` · ${recentCalls} ${t("voiceAgents.recentCalls")}`}
          {lastCost !== undefined &&
            ` · ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(lastCost)}`}
        </p>
      </div>
      <Link
        href={`/voice-agents/${bot.botId}`}
        className="inline-flex items-center gap-1.5 rounded-lg border border-accent/30 px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent-muted"
      >
        <Settings2 className="h-4 w-4" />
        {t("voiceAgents.manage")}
      </Link>
    </li>
  );
}

export default function VoiceAgentsPage() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: botsData, isLoading } = useBots();
  const [search, setSearch] = useState("");
  const bots = useMemo(() => botsData ?? [], [botsData]);

  const tab = useMemo<TabId>(() => {
    const value = searchParams.get("tab");
    return isTabId(value) ? value : "agents";
  }, [searchParams]);

  const urlBotId = searchParams.get("botId") ?? "";
  const [numbersBotId, setNumbersBotId] = useState("");

  useEffect(() => {
    if (urlBotId) setNumbersBotId(urlBotId);
  }, [urlBotId]);

  const effectiveNumbersBotId = numbersBotId || urlBotId || bots[0]?.botId || "";

  const filteredBots = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return bots;
    return bots.filter(
      (bot) =>
        bot.name.toLowerCase().includes(query) ||
        (bot.telephonyPhoneNumber ?? "").includes(query)
    );
  }, [bots, search]);

  const tabs = useMemo(
    () =>
      [
        { id: "agents" as const, label: t("voiceAgents.tab.agents"), icon: <Users className="h-4 w-4" /> },
        {
          id: "phoneNumbers" as const,
          label: t("voiceAgents.tab.phoneNumbers"),
          icon: <Hash className="h-4 w-4" />,
        },
      ] satisfies Array<{ id: TabId; label: string; icon: ReactNode }>,
    [t]
  );

  function setTab(next: TabId) {
    if (next === "agents") {
      router.replace("/voice-agents");
      return;
    }
    const params = new URLSearchParams({ tab: next });
    if (numbersBotId) params.set("botId", numbersBotId);
    else if (effectiveNumbersBotId) params.set("botId", effectiveNumbersBotId);
    router.replace(`/voice-agents?${params.toString()}`);
  }

  function handleNumbersBotChange(botId: string) {
    setNumbersBotId(botId);
    const params = new URLSearchParams({ tab: "phoneNumbers", botId });
    router.replace(`/voice-agents?${params.toString()}`);
  }

  return (
    <DashboardPage maxWidth="6xl" className="space-y-6">
      <PageHeader title={t("voiceAgents.title")} subtitle={t("voiceAgents.subtitle")} />

      <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <VoiceAgentSideNav tabs={tabs} activeTab={tab} onSelect={setTab} />

        <div className="min-w-0 space-y-4">
          {tab === "agents" ? (
            <>
              <SearchInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClear={() => setSearch("")}
                placeholder={t("voiceAgents.searchPlaceholder")}
              />

              <section className="rounded-xl border border-default bg-surface-elevated">
                {isLoading ? (
                  <div className="h-40 animate-pulse rounded-xl bg-surface-muted" />
                ) : filteredBots.length === 0 ? (
                  <p className="p-6 text-sm text-secondary">{t("voiceAgents.empty")}</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {filteredBots.map((bot) => (
                      <VoiceAgentListItem key={bot.botId} bot={bot} />
                    ))}
                  </ul>
                )}
              </section>
            </>
          ) : null}

          {tab === "phoneNumbers" ? (
            <VoiceAgentPhoneNumbersPanel
              botId={effectiveNumbersBotId}
              bots={bots}
              onBotChange={handleNumbersBotChange}
            />
          ) : null}
        </div>
      </div>
    </DashboardPage>
  );
}
