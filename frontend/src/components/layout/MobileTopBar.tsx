"use client";

import { usePathname } from "next/navigation";
import { PanelLeft } from "lucide-react";
import { SoftphoneMobileTrigger } from "@/components/contact-center/SoftphoneMobileTrigger";
import { NotificationsMobileTrigger } from "@/components/notifications/NotificationsMobileTrigger";
import { useT } from "@/i18n/context";
import { useSidebar } from "@/components/layout/SidebarContext";

const ROUTE_LABEL_KEYS: Record<string, string> = {
  "/dashboard": "nav.dashboard",
  "/bots": "nav.bots",
  "/metrics": "nav.metrics",
  "/conversations": "nav.conversations",
  "/reviews": "nav.reviews",
  "/contacts": "nav.contacts",
  "/leads": "nav.leads",
  "/advisors": "nav.advisors",
  "/supervisor": "nav.supervisor",
  "/inbox": "nav.inbox",
  "/contact-center": "nav.contactCenter",
  "/templates": "nav.templates",
  "/bulk-send": "nav.bulkSend",
  "/campaigns": "nav.campaigns",
  "/automations": "nav.automations",
  "/flows": "nav.flows",
  "/forms": "nav.forms",
  "/apps": "nav.apps",
  "/integrations": "nav.integrations",
  "/developer": "nav.developer",
  "/support": "nav.support",
  "/billing": "nav.billing",
  "/settings": "nav.settings",
  "/onboarding": "nav.onboarding",
  "/subaccounts": "nav.subaccounts",
  "/admin/users": "nav.adminUsers",
  "/admin/payments": "nav.adminPayments",
  "/admin/support": "nav.adminSupport",
};

function resolveTitle(pathname: string, t: ReturnType<typeof useT>): string {
  const exact = ROUTE_LABEL_KEYS[pathname];
  if (exact) return t(exact);

  const match = Object.keys(ROUTE_LABEL_KEYS)
    .sort((a, b) => b.length - a.length)
    .find((route) => pathname.startsWith(route));
  if (match) return t(ROUTE_LABEL_KEYS[match]);

  return t("common.appName");
}

export function MobileTopBar() {
  const pathname = usePathname();
  const t = useT();
  const { toggle } = useSidebar();

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-default bg-surface-elevated/95 px-4 py-3 backdrop-blur-md lg:hidden">
      <button
        type="button"
        onClick={toggle}
        className="inline-flex items-center justify-center rounded-xl border border-default p-2 text-secondary transition-colors hover:bg-surface-muted hover:text-primary"
        aria-label={t("nav.openMenu")}
      >
        <PanelLeft className="h-5 w-5" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-primary">{resolveTitle(pathname, t)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <NotificationsMobileTrigger />
        <SoftphoneMobileTrigger />
      </div>
    </header>
  );
}
