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
      className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-default bg-surface-elevated text-secondary shadow-sm transition-colors hover:bg-surface-muted hover:text-primary"
    >
      <Bell className="h-4 w-4" />
      {unreadCount > 0 ? (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null}
    </button>
  );
}
