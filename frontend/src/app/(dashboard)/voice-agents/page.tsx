"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PhoneCall, Settings2 } from "lucide-react";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/ui/SearchInput";
import { useBots } from "@/hooks/useBots";
import { useTelephonyCalls } from "@/hooks/useTelephony";
import { VoiceAgentBotIdCopy } from "@/components/voice-agents/VoiceAgentBotIdCopy";
import { useT } from "@/i18n/context";
import type { Bot } from "@/types";

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
  const { data: botsData, isLoading } = useBots();
  const [search, setSearch] = useState("");
  const bots = botsData ?? [];

  const filteredBots = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return bots;
    return bots.filter(
      (bot) =>
        bot.name.toLowerCase().includes(query) ||
        (bot.telephonyPhoneNumber ?? "").includes(query)
    );
  }, [bots, search]);

  return (
    <DashboardPage maxWidth="6xl">
      <PageHeader title={t("voiceAgents.title")} subtitle={t("voiceAgents.subtitle")} />

      <div className="mb-4">
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch("")}
          placeholder={t("voiceAgents.searchPlaceholder")}
        />
      </div>

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
    </DashboardPage>
  );
}
