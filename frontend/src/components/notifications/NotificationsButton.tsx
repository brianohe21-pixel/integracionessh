"use client";

import { Bell } from "lucide-react";
import { useNotifications } from "@/components/notifications/NotificationsProvider";
import { useT } from "@/i18n/context";

export function NotificationsButton() {
  const t = useT();
  const { toggle, isOpen, unreadCount } = useNotifications();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={isOpen}
      aria-label={t("notifications.openButton")}
      className="topbar-icon relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors"
    >
      <Bell className="h-4 w-4" />
      {unreadCount > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-semibold text-white">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null}
    </button>
  );
}
