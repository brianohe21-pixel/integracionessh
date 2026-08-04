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
      <div className="border-b border-subtle px-4 py-4 sm:px-6">
        <h2 className="text-sm font-semibold text-primary">{t("dashboard.quickActionsTitle")}</h2>
        <p className="mt-0.5 text-xs text-secondary">{t("dashboard.quickActionsSubtitle")}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3 sm:p-6 lg:grid-cols-1">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className="flex items-center gap-2.5 rounded-lg border border-default bg-surface px-3 py-2.5 text-sm font-medium text-primary transition-colors hover:border-accent/30 hover:bg-accent-muted/40"
            >
              <Icon className="h-4 w-4 shrink-0 text-accent" />
              <span className="truncate">{t(action.labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
