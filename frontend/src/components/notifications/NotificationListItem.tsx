"use client";

import Link from "next/link";
import { BellRing, CheckSquare, MessageSquare, UserRound, X } from "lucide-react";
import { useNotifications } from "@/components/notifications/NotificationsProvider";
import { useFormatters } from "@/hooks/useFormatters";
import { useT } from "@/i18n/context";
import type { AppNotification } from "@/types/notifications";
import { cn } from "@/lib/utils";

type NotificationListItemProps = {
  notification: AppNotification;
  onNavigate?: () => void;
};

function NotificationIcon({ type }: { type: AppNotification["type"] }) {
  if (type === "handoff") {
    return <UserRound className="h-4 w-4" />;
  }
  if (type === "task") {
    return <CheckSquare className="h-4 w-4" />;
  }
  if (type === "ops") {
    return <BellRing className="h-4 w-4" />;
  }
  return <MessageSquare className="h-4 w-4" />;
}

export function NotificationListItem({ notification, onNavigate }: NotificationListItemProps) {
  const t = useT();
  const { formatRelativeTime } = useFormatters();
  const { markAsRead, removeNotification } = useNotifications();

  function handleClick() {
    markAsRead(notification.id);
    onNavigate?.();
  }

  return (
    <li>
      <div
        className={cn(
          "group relative rounded-xl border transition-colors",
          notification.read
            ? "border-subtle bg-surface"
            : "border-accent/30 bg-accent-muted/30"
        )}
      >
        <Link
          href={notification.href}
          onClick={handleClick}
          className="flex gap-3 px-3 py-3 pr-10"
        >
          <div
            className={cn(
              "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
              notification.type === "handoff"
                ? "bg-warning/15 text-warning"
                : notification.type === "task"
                  ? "bg-info/15 text-info"
                  : notification.type === "ops"
                    ? "bg-danger/15 text-danger"
                    : "bg-accent-muted text-accent"
            )}
          >
            <NotificationIcon type={notification.type} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-primary line-clamp-1">{notification.title}</p>
              <span className="shrink-0 text-[11px] text-secondary">
                {formatRelativeTime(notification.createdAt)}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-secondary line-clamp-2">{notification.body}</p>
            {!notification.read ? (
              <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-accent">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                {t("notifications.unread")}
              </span>
            ) : null}
          </div>
        </Link>
        <button
          type="button"
          onClick={() => removeNotification(notification.id)}
          className="absolute right-2 top-2 rounded-lg p-1.5 text-secondary opacity-0 transition-opacity hover:bg-surface-muted hover:text-primary group-hover:opacity-100"
          aria-label={t("notifications.remove")}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}
