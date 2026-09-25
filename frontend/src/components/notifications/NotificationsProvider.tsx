"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { subscribeRealtimeEvents } from "@/lib/notifications/bridge";
import { conversationHref, conversationLabel } from "@/lib/notifications/conversation-link";
import { loadNotifications, saveNotifications } from "@/lib/notifications/storage";
import { useTenantRole } from "@/hooks/useTenantRole";
import { useT } from "@/i18n/context";
import { api } from "@/lib/api";
import type { OpsAlert } from "@/types";
import type { AppNotification } from "@/types/notifications";

type NotificationsContextValue = {
  isOpen: boolean;
  notifications: AppNotification[];
  unreadCount: number;
  open: () => void;
  close: () => void;
  toggle: () => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  removeNotification: (id: string) => void;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

function truncate(text: string, max = 120): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function opsToNotification(alert: OpsAlert): AppNotification {
  return {
    id: `ops-${alert.alertId}`,
    type: "ops",
    title: alert.title,
    body: truncate(alert.body),
    href: alert.href || "/alerts",
    alertId: alert.alertId,
    createdAt: alert.createdAt,
    read: Boolean(alert.readAt),
  };
}

function persistLocal(notifications: AppNotification[]) {
  saveNotifications(notifications.filter((item) => item.type !== "ops"));
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const { isAdvisor, loading: roleLoading } = useTenantRole();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    const local = loadNotifications().filter((item) => item.type !== "ops");
    setNotifications(local);
  }, []);

  useEffect(() => {
    if (roleLoading || isAdvisor) return;

    void api
      .get<{ alerts: OpsAlert[] }>("/tenants/me/ops-alerts/history?unreadOnly=true&limit=50")
      .then((data) => {
        const ops = (data.alerts ?? []).map(opsToNotification);
        setNotifications((current) => {
          const withoutOps = current.filter((item) => item.type !== "ops");
          return [...ops, ...withoutOps].slice(0, 100);
        });
      })
      .catch(() => undefined);
  }, [isAdvisor, roleLoading]);

  const addNotification = useCallback((notification: AppNotification) => {
    setNotifications((current) => {
      if (current.some((item) => item.id === notification.id)) return current;
      const next = [notification, ...current].slice(0, 100);
      persistLocal(next);
      return next;
    });
  }, []);

  useEffect(() => {
    return subscribeRealtimeEvents((event) => {
      if (event.type === "message.created") {
        if (event.message.role !== "user") return;

        const label = conversationLabel(event.conversation);
        addNotification({
          id: `message-${event.message.messageId}`,
          type: "message",
          title: t("notifications.types.message", { name: label }),
          body: truncate(event.message.content || t("notifications.emptyBody")),
          href: conversationHref(event.conversation, { advisorMode: isAdvisor }),
          conversationId: event.conversationId,
          createdAt: event.message.timestamp,
          read: false,
        });
        return;
      }

      if (event.type === "conversation.handoff") {
        const label = conversationLabel(event.conversation);
        addNotification({
          id: `handoff-${event.conversation.conversationId}-${event.conversation.handoffAt ?? Date.now()}`,
          type: "handoff",
          title: t("notifications.types.handoff", { name: label }),
          body: t("notifications.handoffBody"),
          href: conversationHref(event.conversation, { advisorMode: isAdvisor }),
          conversationId: event.conversation.conversationId,
          createdAt: event.conversation.handoffAt ?? new Date().toISOString(),
          read: false,
        });
        return;
      }

      if (event.type === "task.reminder") {
        addNotification({
          id: `task-${event.taskId}-${event.createdAt}`,
          type: "task",
          title: t("notifications.types.task", { title: event.title }),
          body: truncate(event.body || t("notifications.taskBody")),
          href: event.href || "/tasks",
          taskId: event.taskId,
          createdAt: event.createdAt,
          read: false,
        });
        return;
      }

      if (event.type === "ops.alert") {
        addNotification(opsToNotification(event.alert));
      }
    });
  }, [addNotification, isAdvisor, t]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  const markAsRead = useCallback((id: string) => {
    setNotifications((current) => {
      const target = current.find((item) => item.id === id);
      if (target?.type === "ops" && target.alertId) {
        void api
          .post(`/tenants/me/ops-alerts/${encodeURIComponent(target.alertId)}/read`, {})
          .catch(() => undefined);
      }
      const next = current.map((item) => (item.id === id ? { ...item, read: true } : item));
      persistLocal(next);
      return next;
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    void api.post("/tenants/me/ops-alerts/read-all", {}).catch(() => undefined);
    setNotifications((current) => {
      const next = current.map((item) => ({ ...item, read: true }));
      persistLocal(next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    persistLocal([]);
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((current) => {
      const next = current.filter((item) => item.id !== id);
      persistLocal(next);
      return next;
    });
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.read).length,
    [notifications]
  );

  const value = useMemo(
    () => ({
      isOpen,
      notifications,
      unreadCount,
      open,
      close,
      toggle,
      markAsRead,
      markAllAsRead,
      clearAll,
      removeNotification,
    }),
    [
      isOpen,
      notifications,
      unreadCount,
      open,
      close,
      toggle,
      markAsRead,
      markAllAsRead,
      clearAll,
      removeNotification,
    ]
  );

  return (
    <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within NotificationsProvider");
  }
  return ctx;
}
