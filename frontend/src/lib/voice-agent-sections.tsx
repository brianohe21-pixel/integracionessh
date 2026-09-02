"use client";

import {
  Braces,
  Hash,
  LayoutDashboard,
  PhoneCall,
  Settings,
  Webhook,
  Wrench,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { useT } from "@/i18n/context";

export const VOICE_AGENT_DETAIL_TABS = [
  "overview",
  "flow",
  "config",
  "numbers",
  "tools",
  "structuredOutputs",
  "calls",
  "webhooks",
  "test",
] as const;

export type VoiceAgentDetailTabId = (typeof VOICE_AGENT_DETAIL_TABS)[number];

export function isVoiceAgentDetailTab(value: string | null): value is VoiceAgentDetailTabId {
  return VOICE_AGENT_DETAIL_TABS.includes(value as VoiceAgentDetailTabId);
}

const TAB_ICONS: Record<VoiceAgentDetailTabId, LucideIcon> = {
  overview: LayoutDashboard,
  flow: Workflow,
  config: Settings,
  numbers: Hash,
  tools: Wrench,
  structuredOutputs: Braces,
  calls: PhoneCall,
  webhooks: Webhook,
  test: PhoneCall,
};

export type VoiceAgentDetailTab = {
  id: VoiceAgentDetailTabId;
  label: string;
  icon: ReactNode;
};

export function useVoiceAgentDetailTabs(): VoiceAgentDetailTab[] {
  const t = useT();

  return useMemo(
    () =>
      VOICE_AGENT_DETAIL_TABS.map((id) => {
        const Icon = TAB_ICONS[id];
        return {
          id,
          label: t(`voiceAgents.tab.${id}`),
          icon: <Icon className="h-4 w-4" />,
        };
      }),
    [t]
  );
}
