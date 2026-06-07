"use client";

import { usePathname } from "next/navigation";
import { PanelLeft } from "lucide-react";
import { useT } from "@/i18n/context";
import { useSidebar } from "@/components/layout/SidebarContext";

const ROUTE_LABEL_KEYS: Record<string, string> = {
  "/bots": "nav.bots",
  "/metrics": "nav.metrics",
  "/conversations": "nav.conversations",
  "/contacts": "nav.contacts",
  "/advisors": "nav.advisors",
  "/inbox": "nav.inbox",
  "/templates": "nav.templates",
  "/bulk-send": "nav.bulkSend",
  "/campaigns": "nav.campaigns",
  "/automations": "nav.automations",
  "/flows": "nav.flows",
  "/developer": "nav.developer",
  "/support": "nav.support",
  "/billing": "nav.billing",
  "/settings": "nav.settings",
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
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 lg:hidden">
      <button
        type="button"
        onClick={toggle}
        className="inline-flex items-center justify-center rounded-lg border border-gray-200 p-2 text-gray-700 hover:bg-gray-50"
        aria-label={t("nav.openMenu")}
      >
        <PanelLeft className="h-5 w-5" />
      </button>
      <p className="truncate text-sm font-semibold text-gray-900">
        {resolveTitle(pathname, t)}
      </p>
    </header>
  );
}
