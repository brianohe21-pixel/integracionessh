"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, MessageCircle } from "lucide-react";
import { AiAssistantSettings } from "@/components/ai-assistant/AiAssistantSettings";
import { useBot } from "@/hooks/useBots";
import { useWhatsAppChannels } from "@/hooks/useWhatsAppChannels";
import { useAiAssistant } from "@/hooks/useAiAssistant";
import { BotForm } from "@/components/bots/BotForm";
import { BotWhatsAppConnect } from "@/components/bots/BotWhatsAppConnect";
import { BotWhatsAppQuality } from "@/components/bots/BotWhatsAppQuality";
import { BotCallingSettings } from "@/components/bots/BotCallingSettings";
import { BotInstagramConnect } from "@/components/bots/BotInstagramConnect";
import { BotTelegramConnect } from "@/components/bots/BotTelegramConnect";
import { BotMessengerConnect } from "@/components/bots/BotMessengerConnect";
import { BotSmsSettings } from "@/components/bots/BotSmsSettings";
import { BotEmailSettings } from "@/components/bots/BotEmailSettings";
import { BotWebchatSettings } from "@/components/bots/BotWebchatSettings";
import { BotVoicebotSettings } from "@/components/bots/BotVoicebotSettings";
import { BotTelephonySettings } from "@/components/bots/BotTelephonySettings";
import { BotMetaFlowsPanel } from "@/components/bots/BotMetaFlowsPanel";
import { BotMacrosPanel } from "@/components/bots/BotMacrosPanel";
import { BotAutomationsPanel } from "@/components/bots/BotAutomationsPanel";
import { BotEditNav, isBotEditTab, type BotEditTab } from "@/components/bots/BotEditNav";
import { useT } from "@/i18n/context";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Tenant } from "@/types";
import { isSubaccountServiceEnabled } from "@/lib/subaccount-services";
import { useEffect } from "react";

export default function EditBotPage() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { botId } = useParams<{ botId: string }>();
  const { data: bot, isLoading } = useBot(botId);
  const { data: aiAssistant } = useAiAssistant(botId);
  const { data: whatsappChannels = [] } = useWhatsAppChannels(botId, {
    enabled: Boolean(botId),
  });
  const defaultWhatsAppChannel =
    whatsappChannels.find((channel) => channel.isDefault) ?? whatsappChannels[0];
  const whatsappPhoneNumberId = defaultWhatsAppChannel?.phoneNumberId;
  const whatsappConnected = Boolean(whatsappPhoneNumberId?.trim());

  const { data: tenant } = useQuery({
    queryKey: ["tenants", "me"],
    queryFn: () => api.get<Tenant>("/tenants/me"),
  });
  const automationsEnabled = isSubaccountServiceEnabled(tenant, "automations");
  const hiddenTabs: BotEditTab[] = automationsEnabled ? [] : ["automations"];

  const tabParam = searchParams.get("tab");
  const activeTab: BotEditTab = isBotEditTab(tabParam) ? tabParam : "general";
  const aiActive = Boolean(aiAssistant?.enabled || bot?.responseMode === "openai");

  useEffect(() => {
    if (activeTab === "automations" && !automationsEnabled) {
      router.replace(`/bots/${botId}/edit?tab=general`, { scroll: false });
    }
  }, [activeTab, automationsEnabled, botId, router]);

  function setTab(nextTab: BotEditTab) {
    router.replace(`/bots/${botId}/edit?tab=${nextTab}`, { scroll: false });
  }

  if (isLoading) {
    return (
      <DashboardPage className="lg:px-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-48 rounded bg-surface-muted" />
          <div className="h-4 w-64 rounded bg-surface-muted" />
          <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
            <div className="h-80 rounded-xl bg-surface-muted" />
            <div className="space-y-4 rounded-xl border border-default bg-surface-elevated p-6">
              <div className="h-10 rounded bg-surface-muted" />
              <div className="h-32 rounded bg-surface-muted" />
              <div className="h-10 rounded bg-surface-muted" />
            </div>
          </div>
        </div>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage className="lg:px-6">
      <Link
        href="/bots"
        className="mb-4 flex items-center gap-1 text-sm text-secondary transition-colors hover:text-primary"
      >
        <ChevronLeft className="h-4 w-4" />
        {t("bots.backToBots")}
      </Link>
      <PageHeader
        title={t("bots.editBot", { name: bot?.name ?? t("bots.defaultName") })}
        subtitle={t("bots.editSubtitle")}
      />

      <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <BotEditNav
          activeTab={activeTab}
          onSelect={setTab}
          aiActive={aiActive}
          hiddenTabs={hiddenTabs}
        />

        <div className="min-w-0">
          {bot && activeTab === "general" && (
            <div className="content-card p-5 sm:p-6">
              <div className="mb-6 flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-accent" />
                <h2 className="text-lg font-semibold text-primary">{t("bots.tabGeneral")}</h2>
              </div>
              <BotForm bot={bot} wide />
            </div>
          )}

          {bot && activeTab === "aiAssistant" && <AiAssistantSettings bot={bot} />}

          {bot && activeTab === "whatsapp" && (
            <div className="space-y-4">
              <BotWhatsAppConnect bot={bot} />
              {whatsappConnected ? (
                <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
                  <BotWhatsAppQuality
                    botId={bot.botId}
                    phoneNumberId={whatsappPhoneNumberId!}
                    whatsappPhone={bot.whatsappPhone}
                  />
                  <BotCallingSettings
                    botId={bot.botId}
                    coexistence={
                      (defaultWhatsAppChannel?.whatsappOnboardingMode ??
                        bot.whatsappOnboardingMode) === "coexistence"
                    }
                  />
                </div>
              ) : null}
            </div>
          )}

          {bot && activeTab === "instagram" && <BotInstagramConnect bot={bot} />}
          {bot && activeTab === "webchat" && <BotWebchatSettings bot={bot} />}
          {bot && activeTab === "telegram" && <BotTelegramConnect bot={bot} />}
          {bot && activeTab === "messenger" && <BotMessengerConnect bot={bot} />}
          {bot && activeTab === "sms" && <BotSmsSettings bot={bot} />}
          {bot && activeTab === "email" && <BotEmailSettings bot={bot} />}
          {bot && activeTab === "voicebot" && <BotVoicebotSettings bot={bot} />}
          {bot && activeTab === "telephony" && <BotTelephonySettings botId={bot.botId} />}
          {bot && activeTab === "macros" && <BotMacrosPanel bot={bot} />}
          {bot && activeTab === "metaFlows" && <BotMetaFlowsPanel botId={bot.botId} />}
          {bot && activeTab === "automations" && automationsEnabled && (
            <BotAutomationsPanel botId={bot.botId} />
          )}
        </div>
      </div>
    </DashboardPage>
  );
}
