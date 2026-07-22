"use client";

import { useMemo, type ReactNode } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  BookOpen,
  ChevronLeft,
  Globe,
  Camera,
  MessageCircle,
  MessageSquarePlus,
  Phone,
  Settings,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { useBot } from "@/hooks/useBots";
import { BotForm } from "@/components/bots/BotForm";
import { BotKnowledge } from "@/components/bots/BotKnowledge";
import { BotWhatsAppQuality } from "@/components/bots/BotWhatsAppQuality";
import { BotCallingSettings } from "@/components/bots/BotCallingSettings";
import { BotInstagramConnect } from "@/components/bots/BotInstagramConnect";
import { BotWebchatSettings } from "@/components/bots/BotWebchatSettings";
import { BotMetaFlowsPanel } from "@/components/bots/BotMetaFlowsPanel";
import { BotMacrosPanel } from "@/components/bots/BotMacrosPanel";
import { useT } from "@/i18n/context";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";

const TAB_IDS = [
  "general",
  "whatsapp",
  "instagram",
  "webchat",
  "knowledge",
  "macros",
  "metaFlows",
] as const;

type BotEditTab = (typeof TAB_IDS)[number];

function isBotEditTab(value: string | null): value is BotEditTab {
  return TAB_IDS.includes(value as BotEditTab);
}

export default function EditBotPage() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { botId } = useParams<{ botId: string }>();
  const { data: bot, isLoading } = useBot(botId);

  const tabParam = searchParams.get("tab");
  const activeTab: BotEditTab = isBotEditTab(tabParam) ? tabParam : "general";

  const tabs = useMemo(
    () =>
      [
        { id: "general" as const, label: t("bots.tabGeneral"), icon: <Settings className="w-4 h-4" /> },
        { id: "whatsapp" as const, label: t("bots.tabWhatsapp"), icon: <Phone className="w-4 h-4" /> },
        { id: "instagram" as const, label: t("bots.tabInstagram"), icon: <Camera className="w-4 h-4" /> },
        { id: "webchat" as const, label: t("bots.tabWebchat"), icon: <Globe className="w-4 h-4" /> },
        { id: "knowledge" as const, label: t("bots.tabKnowledge"), icon: <BookOpen className="w-4 h-4" /> },
        { id: "macros" as const, label: t("bots.tabMacros"), icon: <MessageSquarePlus className="w-4 h-4" /> },
        { id: "metaFlows" as const, label: t("bots.tabMetaFlows"), icon: <Workflow className="w-4 h-4" /> },
      ] satisfies { id: BotEditTab; label: string; icon: ReactNode }[],
    [t]
  );

  function setTab(nextTab: BotEditTab) {
    router.replace(`/bots/${botId}/edit?tab=${nextTab}`, { scroll: false });
  }

  if (isLoading) {
    return (
      <DashboardPage className="lg:px-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-48 bg-gray-200 rounded" />
          <div className="h-4 w-64 bg-gray-200 rounded" />
          <div className="h-10 bg-gray-200 rounded" />
          <div className="bg-surface-elevated rounded-xl border border-default p-6 space-y-4">
            <div className="h-10 bg-gray-200 rounded" />
            <div className="h-32 bg-gray-200 rounded" />
            <div className="h-10 bg-gray-200 rounded" />
          </div>
        </div>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage className="lg:px-6">
      <Link
        href="/bots"
        className="flex items-center gap-1 text-sm text-secondary hover:text-secondary mb-4"
      >
        <ChevronLeft className="w-4 h-4" />
        {t("bots.backToBots")}
      </Link>
      <PageHeader
        title={t("bots.editBot", { name: bot?.name ?? t("bots.defaultName") })}
        subtitle={t("bots.editSubtitle")}
      />

      <div className="mb-6 flex flex-wrap gap-x-1 gap-y-0 border-b border-default">
        {tabs.map((tabItem) => (
          <button
            key={tabItem.id}
            type="button"
            onClick={() => setTab(tabItem.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tabItem.id
                ? "border-accent text-accent"
                : "border-transparent text-secondary hover:text-secondary hover:border-default"
            }`}
          >
            {tabItem.icon}
            {tabItem.label}
          </button>
        ))}
      </div>

      {bot && activeTab === "general" && (
        <div className="bg-surface-elevated rounded-xl border border-default p-6">
          <div className="flex items-center gap-2 mb-6">
            <MessageCircle className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-semibold text-primary">{t("bots.tabGeneral")}</h2>
          </div>
          <BotForm bot={bot} wide />
        </div>
      )}

      {bot && activeTab === "whatsapp" && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
          <BotWhatsAppQuality
            botId={bot.botId}
            phoneNumberId={bot.phoneNumberId}
            whatsappPhone={bot.whatsappPhone}
          />
          <BotCallingSettings botId={bot.botId} />
        </div>
      )}

      {bot && activeTab === "instagram" && <BotInstagramConnect bot={bot} />}

      {bot && activeTab === "webchat" && <BotWebchatSettings bot={bot} />}

      {bot && activeTab === "knowledge" && <BotKnowledge bot={bot} />}

      {bot && activeTab === "macros" && <BotMacrosPanel bot={bot} />}

      {bot && activeTab === "metaFlows" && <BotMetaFlowsPanel botId={bot.botId} />}
    </DashboardPage>
  );
}
