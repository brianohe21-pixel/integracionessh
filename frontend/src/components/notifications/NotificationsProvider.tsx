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
import { useT } from "@/i18n/context";
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
  removeNotification: (id: string) => void;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

function truncate(text: string, max = 120): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    setNotifications(loadNotifications());
  }, []);

  const addNotification = useCallback(
    (notification: AppNotification) => {
      setNotifications((current) => {
        if (current.some((item) => item.id === notification.id)) return current;
        const next = [notification, ...current].slice(0, 100);
        saveNotifications(next);
        return next;
      });
    },
    []
  );

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
          href: conversationHref(event.conversation),
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
          href: conversationHref(event.conversation),
          conversationId: event.conversation.conversationId,
          createdAt: event.conversation.handoffAt ?? new Date().toISOString(),
          read: false,
        });
      }
    });
  }, [addNotification, t]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  const markAsRead = useCallback((id: string) => {
    setNotifications((current) => {
      const next = current.map((item) => (item.id === id ? { ...item, read: true } : item));
      saveNotifications(next);
      return next;
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((current) => {
      const next = current.map((item) => ({ ...item, read: true }));
      saveNotifications(next);
      return next;
    });
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((current) => {
      const next = current.filter((item) => item.id !== id);
      saveNotifications(next);
      return next;
    });
  }, []);

  const unreadCount = notifications.filter((item) => !item.read).length;

  const value = useMemo<NotificationsContextValue>(
    () => ({
      isOpen,
      notifications,
      unreadCount,
      open,
      close,
      toggle,
      markAsRead,
      markAllAsRead,
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
      removeNotification,
    ]
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationsProvider");
  }
  return context;
}
