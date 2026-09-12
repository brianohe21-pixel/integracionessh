"use client";

import type { ReactNode } from "react";
import {
  Camera,
  Globe,
  Mail,
  MessageSquarePlus,
  MessagesSquare,
  Mic,
  Phone,
  PhoneCall,
  Send,
  Settings,
  Sparkles,
  Workflow,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/context";

export const BOT_EDIT_TAB_IDS = [
  "general",
  "aiAssistant",
  "whatsapp",
  "instagram",
  "webchat",
  "telegram",
  "messenger",
  "sms",
  "email",
  "voicebot",
  "telephony",
  "macros",
  "metaFlows",
  "automations",
] as const;

export type BotEditTab = (typeof BOT_EDIT_TAB_IDS)[number];

export function isBotEditTab(value: string | null): value is BotEditTab {
  return BOT_EDIT_TAB_IDS.includes(value as BotEditTab);
}

type BotEditNavGroup = {
  id: string;
  labelKey: string;
  tabs: {
    id: BotEditTab;
    labelKey: string;
    icon: ReactNode;
  }[];
};

export function useBotEditNavGroups(hiddenTabs: BotEditTab[] = []): BotEditNavGroup[] {
  const hidden = new Set(hiddenTabs);
  const visible = (tab: BotEditTab) => !hidden.has(tab);

  return [
    {
      id: "general",
      labelKey: "bots.navGroupGeneral",
      tabs: [
        {
          id: "general",
          labelKey: "bots.tabGeneral",
          icon: <Settings className="h-4 w-4" />,
        },
        {
          id: "aiAssistant",
          labelKey: "bots.tabAiAssistant",
          icon: <Sparkles className="h-4 w-4" />,
        },
      ],
    },
    {
      id: "channels",
      labelKey: "bots.navGroupChannels",
      tabs: [
        { id: "whatsapp", labelKey: "bots.tabWhatsapp", icon: <Phone className="h-4 w-4" /> },
        { id: "instagram", labelKey: "bots.tabInstagram", icon: <Camera className="h-4 w-4" /> },
        { id: "webchat", labelKey: "bots.tabWebchat", icon: <Globe className="h-4 w-4" /> },
        { id: "telegram", labelKey: "bots.tabTelegram", icon: <Send className="h-4 w-4" /> },
        { id: "messenger", labelKey: "bots.tabMessenger", icon: <MessagesSquare className="h-4 w-4" /> },
        { id: "sms", labelKey: "bots.tabSms", icon: <Phone className="h-4 w-4" /> },
        { id: "email", labelKey: "bots.tabEmail", icon: <Mail className="h-4 w-4" /> },
      ],
    },
    {
      id: "voice",
      labelKey: "bots.navGroupVoice",
      tabs: [
        { id: "voicebot", labelKey: "bots.tabVoicebot", icon: <Mic className="h-4 w-4" /> },
        { id: "telephony", labelKey: "bots.tabTelephony", icon: <PhoneCall className="h-4 w-4" /> },
      ],
    },
    {
      id: "tools",
      labelKey: "bots.navGroupTools",
      tabs: [
        { id: "macros", labelKey: "bots.tabMacros", icon: <MessageSquarePlus className="h-4 w-4" /> },
        { id: "metaFlows", labelKey: "bots.tabMetaFlows", icon: <Workflow className="h-4 w-4" /> },
        { id: "automations", labelKey: "bots.tabAutomations", icon: <Zap className="h-4 w-4" /> },
      ],
    },
  ]
    .map((group) => ({
      ...group,
      tabs: group.tabs.filter((tab) => visible(tab.id)),
    }))
    .filter((group) => group.tabs.length > 0);
}

interface BotEditNavProps {
  activeTab: BotEditTab;
  onSelect: (tab: BotEditTab) => void;
  aiActive?: boolean;
  hiddenTabs?: BotEditTab[];
}

export function BotEditNav({ activeTab, onSelect, aiActive, hiddenTabs = [] }: BotEditNavProps) {
  const t = useT();
  const groups = useBotEditNavGroups(hiddenTabs);

  return (
    <div className="space-y-5">
      <div className="content-card overflow-hidden lg:hidden">
        <label className="section-header">
          <span className="section-header-title">{t("bots.navSectionTitle")}</span>
          <span className="section-header-subtitle">{t("bots.navSectionSubtitle")}</span>
        </label>
        <div className="p-4">
          <select
            value={activeTab}
            onChange={(event) => onSelect(event.target.value as BotEditTab)}
            className="w-full rounded-xl border border-default bg-surface-elevated px-3 py-2.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          >
            {groups.flatMap((group) =>
              group.tabs.map((tab) => (
                <option key={tab.id} value={tab.id}>
                  {t(tab.labelKey)}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      <div className="hidden lg:block">
        <div className="content-card overflow-hidden p-3">
          <button
            type="button"
            onClick={() => onSelect("aiAssistant")}
            className={cn(
              "mb-3 w-full rounded-xl px-3 py-3 text-left transition-colors",
              activeTab === "aiAssistant"
                ? "bg-accent-muted"
                : "bg-accent-muted/50 hover:bg-accent-muted/70"
            )}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" />
              <div>
                <p className="text-xs font-semibold text-primary">{t("aiAssistant.title")}</p>
                <p className="text-[11px] text-secondary">
                  {aiActive ? t("aiAssistant.statusActive") : t("aiAssistant.statusInactive")}
                </p>
              </div>
            </div>
          </button>

          {groups.map((group) => (
            <div key={group.id} className="mb-4 last:mb-0">
              <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                {t(group.labelKey)}
              </p>
              <div className="space-y-0.5">
                {group.tabs.map((tab) => {
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => onSelect(tab.id)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                        active
                          ? "bg-accent-muted font-semibold text-accent"
                          : "text-secondary hover:bg-surface-muted hover:text-primary"
                      )}
                    >
                      {tab.icon}
                      <span className="truncate">{t(tab.labelKey)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
