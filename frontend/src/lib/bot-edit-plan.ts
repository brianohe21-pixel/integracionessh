import { isProPlusPlan } from "@/lib/plan-nav";
import type { TenantPlan } from "@/types";

export const PRO_ONLY_BOT_EDIT_TABS = ["sms", "email", "voicebot", "telephony"] as const;

export type ProOnlyBotEditTab = (typeof PRO_ONLY_BOT_EDIT_TABS)[number];

export function isProOnlyBotEditTab(tab: string): tab is ProOnlyBotEditTab {
  return (PRO_ONLY_BOT_EDIT_TABS as readonly string[]).includes(tab);
}

export function getLockedBotEditTabs(plan: TenantPlan | undefined): ProOnlyBotEditTab[] {
  if (isProPlusPlan(plan)) return [];
  return [...PRO_ONLY_BOT_EDIT_TABS];
}

export function isBotEditTabLockedForPlan(tab: string, plan: TenantPlan | undefined): boolean {
  return isProOnlyBotEditTab(tab) && !isProPlusPlan(plan);
}
