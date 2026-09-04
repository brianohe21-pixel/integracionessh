"use client";

import Link from "next/link";
import { MessageSquare, UserRound, X } from "lucide-react";
import { NotificationListItem } from "@/components/notifications/NotificationListItem";
import { useNotifications } from "@/components/notifications/NotificationsProvider";
import { EmptyState } from "@/components/ui/EmptyState";
import { useTenantRole } from "@/hooks/useTenantRole";
import { useT } from "@/i18n/context";
import { cn } from "@/lib/utils";

export function NotificationsPanel() {
  const t = useT();
  const { isAdvisor } = useTenantRole();
  const { isOpen, close, notifications, unreadCount, markAllAsRead } = useNotifications();
  const conversationsHref = isAdvisor ? "/inbox" : "/conversations";

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/40 transition-opacity",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={close}
        aria-hidden={!isOpen}
      />

      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-default bg-surface-elevated shadow-xl transition-transform duration-200",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
        aria-hidden={!isOpen}
      >
        <div className="flex items-center justify-between border-b border-default px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-primary">{t("notifications.title")}</h2>
            <p className="text-xs text-secondary">{t("notifications.subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded-lg p-2 text-secondary hover:bg-surface-muted hover:text-primary"
            aria-label={t("notifications.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {unreadCount > 0 ? (
          <div className="flex items-center justify-between border-b border-default px-5 py-2.5">
            <span className="text-xs text-secondary">
              {t("notifications.unreadCount", { count: unreadCount })}
            </span>
            <button
              type="button"
              onClick={markAllAsRead}
              className="text-xs font-medium text-accent hover:text-accent-hover"
            >
              {t("notifications.markAllRead")}
            </button>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {notifications.length === 0 ? (
            <EmptyState
              icon={<BellMutedIcon />}
              title={t("notifications.empty")}
              description={t("notifications.emptyHint")}
              className="py-12"
            />
          ) : (
            <ul className="space-y-2">
              {notifications.map((notification) => (
                <NotificationListItem key={notification.id} notification={notification} onNavigate={close} />
              ))}
            </ul>
          )}
        </div>

        {notifications.length > 0 ? (
          <div className="border-t border-default px-5 py-3">
            <Link
              href={conversationsHref}
              onClick={close}
              className="inline-flex w-full items-center justify-center rounded-lg border border-default bg-surface px-4 py-2.5 text-sm font-medium text-primary hover:bg-surface-muted"
            >
              {t("notifications.viewConversations")}
            </Link>
          </div>
        ) : null}
      </aside>
    </>
  );
}

function BellMutedIcon() {
  return (
    <span className="relative">
      <MessageSquare className="h-6 w-6" />
      <UserRound className="absolute -bottom-1 -right-1 h-3.5 w-3.5" />
    </span>
  );
}
