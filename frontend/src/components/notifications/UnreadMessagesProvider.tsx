"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { api, getTenantContext } from "@/lib/api";
import { subscribeRealtimeEvents } from "@/lib/notifications/bridge";
import { conversationHref, conversationLabel } from "@/lib/notifications/conversation-link";
import { loadUnreadCounts, saveUnreadCounts } from "@/lib/unread-messages/storage";
import { useTenantRole } from "@/hooks/useTenantRole";
import { useT } from "@/i18n/context";
import { MessageToast } from "@/components/notifications/MessageToast";
import type { Conversation, ConversationsListResponse } from "@/types";

export type MessageToastState = {
  id: string;
  title: string;
  body: string;
  href: string;
};

type UnreadMessagesContextValue = {
  totalUnread: number;
  getUnreadCount: (conversationId: string) => number;
  setActiveConversationId: (conversationId: string | null) => void;
  markConversationRead: (conversationId: string, botId?: string, workflowStatus?: string) => void;
};

const UnreadMessagesContext = createContext<UnreadMessagesContextValue | null>(null);

function truncate(text: string, max = 120): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function sumUnreadCounts(counts: Record<string, number>): number {
  return Object.values(counts).reduce((total, value) => total + value, 0);
}

function showBrowserNotification(title: string, body: string, href: string) {
  if (typeof window === "undefined" || !document.hidden) return;
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

  const notification = new Notification(title, { body });
  notification.onclick = () => {
    window.focus();
    window.location.href = href;
    notification.close();
  };
}

export function UnreadMessagesProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const queryClient = useQueryClient();
  const { isAdvisor } = useTenantRole();
  const scopeRef = useRef(getTenantContext() ?? "default");
  const activeConversationIdRef = useRef<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [toast, setToast] = useState<MessageToastState | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    scopeRef.current = getTenantContext() ?? "default";
    setCounts(loadUnreadCounts(scopeRef.current));
  }, []);

  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }, []);

  const persistCounts = useCallback((next: Record<string, number>) => {
    saveUnreadCounts(scopeRef.current, next);
    setCounts(next);
  }, []);

  const syncFromConversationsCache = useCallback(() => {
    const queries = queryClient.getQueriesData<InfiniteData<ConversationsListResponse>>({
      queryKey: ["conversations", "list"],
    });

    const newConversationIds = new Set<string>();
    for (const [, data] of queries) {
      for (const page of data?.pages ?? []) {
        for (const conversation of page.items) {
          if (conversation.workflowStatus === "new") {
            newConversationIds.add(conversation.conversationId);
          }
        }
      }
    }

    if (newConversationIds.size === 0) return;

    setCounts((current) => {
      let changed = false;
      const next = { ...current };
      for (const conversationId of newConversationIds) {
        if ((next[conversationId] ?? 0) < 1) {
          next[conversationId] = 1;
          changed = true;
        }
      }
      if (!changed) return current;
      saveUnreadCounts(scopeRef.current, next);
      return next;
    });
  }, [queryClient]);

  useEffect(() => {
    syncFromConversationsCache();
    return queryClient.getQueryCache().subscribe((event) => {
      if (event?.query.queryKey[0] === "conversations" && event?.query.queryKey[1] === "list") {
        syncFromConversationsCache();
      }
    });
  }, [queryClient, syncFromConversationsCache]);

  const notifyIncomingMessage = useCallback(
    (conversation: Conversation, content: string, messageId: string) => {
      const label = conversationLabel(conversation);
      const href = conversationHref(conversation, { advisorMode: isAdvisor });
      const title = t("notifications.types.message", { name: label });
      const body = truncate(content || t("notifications.emptyBody"));

      if (document.hidden) {
        showBrowserNotification(title, body, href);
        return;
      }

      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      setToast({ id: messageId, title, body, href });
      toastTimerRef.current = setTimeout(() => setToast(null), 6_000);
    },
    [isAdvisor, t]
  );

  useEffect(() => {
    return subscribeRealtimeEvents((event) => {
      if (event.type === "message.created") {
        if (event.message.role !== "user") return;
        if (event.conversationId === activeConversationIdRef.current) return;

        setCounts((current) => {
          const next = {
            ...current,
            [event.conversationId]: (current[event.conversationId] ?? 0) + 1,
          };
          saveUnreadCounts(scopeRef.current, next);
          return next;
        });

        notifyIncomingMessage(event.conversation, event.message.content, event.message.messageId);
        return;
      }

      if (event.type === "conversation.handoff") {
        if (event.conversation.conversationId === activeConversationIdRef.current) return;

        setCounts((current) => {
          const next = {
            ...current,
            [event.conversation.conversationId]: Math.max(current[event.conversation.conversationId] ?? 0, 1),
          };
          saveUnreadCounts(scopeRef.current, next);
          return next;
        });

        if (document.hidden) {
          const label = conversationLabel(event.conversation);
          showBrowserNotification(
            t("notifications.types.handoff", { name: label }),
            t("notifications.handoffBody"),
            conversationHref(event.conversation, { advisorMode: isAdvisor })
          );
        }
      }
    });
  }, [isAdvisor, notifyIncomingMessage, t]);

  const setActiveConversationId = useCallback((conversationId: string | null) => {
    activeConversationIdRef.current = conversationId;
  }, []);

  const markConversationRead = useCallback(
    (conversationId: string, botId?: string, workflowStatus?: string) => {
      setCounts((current) => {
        if (!current[conversationId]) return current;
        const next = { ...current };
        delete next[conversationId];
        saveUnreadCounts(scopeRef.current, next);
        return next;
      });

      if (botId && workflowStatus === "new") {
        void api
          .patch(`/conversations/${encodeURIComponent(conversationId)}/status`, {
            botId,
            workflowStatus: "open",
          })
          .then(() => {
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
          })
          .catch(() => undefined);
      }
    },
    [queryClient]
  );

  const getUnreadCount = useCallback(
    (conversationId: string) => counts[conversationId] ?? 0,
    [counts]
  );

  const totalUnread = useMemo(() => sumUnreadCounts(counts), [counts]);

  const dismissToast = useCallback(() => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(null);
  }, []);

  const value = useMemo<UnreadMessagesContextValue>(
    () => ({
      totalUnread,
      getUnreadCount,
      setActiveConversationId,
      markConversationRead,
    }),
    [totalUnread, getUnreadCount, setActiveConversationId, markConversationRead]
  );

  return (
    <UnreadMessagesContext.Provider value={value}>
      {children}
      {toast ? <MessageToast toast={toast} onDismiss={dismissToast} /> : null}
    </UnreadMessagesContext.Provider>
  );
}

export function useUnreadMessages() {
  const context = useContext(UnreadMessagesContext);
  if (!context) {
    throw new Error("useUnreadMessages must be used within UnreadMessagesProvider");
  }
  return context;
}
