"use client";

import Link from "next/link";
import {
  BotMessageSquare,
  Megaphone,
  MessageSquare,
  GitBranch,
  LayoutTemplate,
} from "lucide-react";
import { useT } from "@/i18n/context";

const QUICK_ACTIONS = [
  { href: "/bots/new", labelKey: "dashboard.quickNewBot", icon: BotMessageSquare },
  { href: "/campaigns/new", labelKey: "dashboard.quickNewCampaign", icon: Megaphone },
  { href: "/conversations", labelKey: "dashboard.quickConversations", icon: MessageSquare },
  { href: "/flows/new", labelKey: "dashboard.quickNewFlow", icon: GitBranch },
  { href: "/templates", labelKey: "dashboard.quickTemplates", icon: LayoutTemplate },
] as const;

export function DashboardQuickActions() {
  const t = useT();

  return (
    <div className="content-card overflow-hidden">
      <div className="px-4 pb-3 pt-4 sm:px-6 sm:pt-6">
        <h2 className="text-sm font-semibold text-primary">{t("dashboard.quickActionsTitle")}</h2>
        <p className="mt-0.5 text-xs text-muted">{t("dashboard.quickActionsSubtitle")}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 px-4 pb-4 sm:grid-cols-3 sm:px-5 sm:pb-5 lg:grid-cols-1">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className="group flex items-center gap-2.5 rounded-xl border border-default bg-surface px-3 py-3 text-sm font-medium text-primary transition-all hover:border-accent/30 hover:bg-accent-muted/30 hover:shadow-sm"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-muted text-accent transition-transform group-hover:scale-105">
                <Icon className="h-4 w-4" />
              </span>
              <span className="truncate">{t(action.labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
