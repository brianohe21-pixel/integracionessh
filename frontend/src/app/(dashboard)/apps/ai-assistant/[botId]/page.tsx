"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useParams } from "next/navigation";
import { useBot } from "@/hooks/useBots";
import { AiAssistantSettings } from "@/components/ai-assistant/AiAssistantSettings";
import { useT } from "@/i18n/context";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";

export default function AiAssistantAgentPage() {
  const t = useT();
  const { botId } = useParams<{ botId: string }>();
  const { data: bot, isLoading } = useBot(botId);

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
    <DashboardPage>
      <Link
        href="/apps/ai-assistant"
        className="mb-4 flex items-center gap-1 text-sm text-secondary hover:text-secondary"
      >
        <ChevronLeft className="h-4 w-4" />
        {t("aiAssistant.backToApps")}
      </Link>
      <PageHeader
        title={t("aiAssistant.manageTitle", { name: bot.name })}
        subtitle={t("aiAssistant.manageSubtitle")}
      />
      <AiAssistantSettings bot={bot} />
    </DashboardPage>
  );
}
