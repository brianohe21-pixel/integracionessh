"use client";

import { LayoutGrid } from "lucide-react";
import { SoftphoneToolbarTrigger } from "@/components/contact-center/SoftphoneToolbarTrigger";
import { HelpCenterToolbarTrigger } from "@/components/help-center/HelpCenterToolbarTrigger";
import { NotificationsDesktopTrigger } from "@/components/notifications/NotificationsDesktopTrigger";
import { TenantBrand } from "@/components/layout/TenantBrand";
import { UserMenuTrigger } from "@/components/layout/UserMenuTrigger";
import { useSidebar } from "@/components/layout/SidebarContext";
import { useUnreadMessages } from "@/components/notifications/UnreadMessagesProvider";
import { useT } from "@/i18n/context";

export function PlatformToolbar() {
  const t = useT();
  const { toggle, toggleCollapsed, isCollapsed } = useSidebar();
  const { totalUnread } = useUnreadMessages();

  return (
    <header className="platform-topbar sticky top-0 z-50 flex h-14 w-full shrink-0 items-center gap-1 px-2 lg:px-3">
      <button
        type="button"
        onClick={toggle}
        className="topbar-icon relative inline-flex h-8 w-8 items-center justify-center rounded-lg lg:hidden"
        aria-label={t("nav.openMenu")}
      >
        <LayoutGrid className="h-5 w-5" />
        {totalUnread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-semibold text-white">
            {totalUnread > 9 ? "9+" : totalUnread}
          </span>
        ) : null}
      </button>
      <button
        type="button"
        onClick={toggleCollapsed}
        className="topbar-icon hidden h-8 w-8 items-center justify-center rounded-lg lg:inline-flex"
        aria-label={isCollapsed ? t("nav.expandSidebar") : t("nav.collapseSidebar")}
      >
        <LayoutGrid className="h-5 w-5" />
      </button>
      <TenantBrand className="min-w-0 pl-1" />
      <div className="ml-auto flex shrink-0 items-center gap-0.5">
        <HelpCenterToolbarTrigger />
        <NotificationsDesktopTrigger />
        <SoftphoneToolbarTrigger />
        <UserMenuTrigger />
      </div>
    </header>
  );
}
