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
import { emitRealtimeEvent, subscribeRealtimeEvents } from "@/lib/notifications/bridge";
import { conversationHref, conversationLabel } from "@/lib/notifications/conversation-link";
import { loadUnreadCounts, saveUnreadCounts } from "@/lib/unread-messages/storage";
import { fetchInboxConversationsForSync } from "@/hooks/useConversations";
import { useRealtimeConnection } from "@/components/realtime/RealtimeProvider";
import { useTenantRole } from "@/hooks/useTenantRole";
import { useT } from "@/i18n/context";
import { MessageToast } from "@/components/notifications/MessageToast";
import type { Conversation, ConversationsListResponse, Message } from "@/types";

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
  markConversationRead: (
    conversationId: string,
    botId?: string,
    workflowStatus?: string,
    lastMessageAt?: string
  ) => void;
};

const UnreadMessagesContext = createContext<UnreadMessagesContextValue | null>(null);

const MAX_SEEN_MESSAGE_IDS = 500;

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

function buildSyntheticUserMessage(conversation: Conversation, timestamp: string): Message {
  return {
    messageId: `sync-${conversation.conversationId}-${timestamp}`,
    conversationId: conversation.conversationId,
    tenantId: conversation.tenantId,
    role: "user",
    content: "",
    channel: conversation.channel ?? "whatsapp",
    timestamp,
  };
}

export function UnreadMessagesProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const queryClient = useQueryClient();
  const { connected } = useRealtimeConnection();
  const { isAdvisor, isAdmin, loading: roleLoading } = useTenantRole();
  const scopeRef = useRef(getTenantContext() ?? "default");
  const activeConversationIdRef = useRef<string | null>(null);
  const lastSeenMessageAtRef = useRef<Record<string, string>>({});
  const seenMessageIdsRef = useRef<Set<string>>(new Set());
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

  const rememberMessageId = useCallback((messageId: string) => {
    const seen = seenMessageIdsRef.current;
    if (seen.has(messageId)) return false;
    seen.add(messageId);
    if (seen.size > MAX_SEEN_MESSAGE_IDS) {
      const oldest = seen.values().next().value;
      if (oldest) seen.delete(oldest);
    }
    return true;
  }, []);

  const bumpUnread = useCallback((conversationId: string, amount = 1) => {
    setCounts((current) => {
      const next = {
        ...current,
        [conversationId]: (current[conversationId] ?? 0) + amount,
      };
      saveUnreadCounts(scopeRef.current, next);
      return next;
    });
  }, []);

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

  const handleUserMessage = useCallback(
    (conversation: Conversation, message: Message) => {
      if (message.role !== "user") return;
      if (!rememberMessageId(message.messageId)) return;
      if (conversation.conversationId === activeConversationIdRef.current) return;

      const lastAt = message.timestamp || conversation.lastMessageAt;
      if (lastAt) {
        lastSeenMessageAtRef.current[conversation.conversationId] = lastAt;
      }

      bumpUnread(conversation.conversationId);
      notifyIncomingMessage(
        conversation,
        message.content,
        message.messageId
      );
    },
    [bumpUnread, notifyIncomingMessage, rememberMessageId]
  );

  const syncFromConversationsCache = useCallback(() => {
    const queries = queryClient.getQueriesData<InfiniteData<ConversationsListResponse>>({
      queryKey: ["conversations", "list"],
    });

    for (const [, data] of queries) {
      for (const page of data?.pages ?? []) {
        for (const conversation of page.items) {
          if (conversation.workflowStatus !== "new") continue;
          if (conversation.conversationId === activeConversationIdRef.current) continue;
          setCounts((current) => {
            if ((current[conversation.conversationId] ?? 0) >= 1) return current;
            const next = { ...current, [conversation.conversationId]: 1 };
            saveUnreadCounts(scopeRef.current, next);
            return next;
          });
        }
      }
    }
  }, [queryClient]);

  const pollInboxConversations = useCallback(async () => {
    if (roleLoading || isAdmin) return;

    try {
      const conversations = await fetchInboxConversationsForSync();

      for (const conversation of conversations) {
        const conversationId = conversation.conversationId;
        const lastAt = conversation.lastMessageAt ?? "";
        const previousAt = lastSeenMessageAtRef.current[conversationId];

        if (!previousAt) {
          lastSeenMessageAtRef.current[conversationId] = lastAt;
          if (
            conversation.workflowStatus === "new" &&
            conversationId !== activeConversationIdRef.current
          ) {
            setCounts((current) => {
              if ((current[conversationId] ?? 0) >= 1) return current;
              const next = { ...current, [conversationId]: 1 };
              saveUnreadCounts(scopeRef.current, next);
              return next;
            });
          }
          continue;
        }

        if (
          lastAt &&
          lastAt > previousAt &&
          conversationId !== activeConversationIdRef.current
        ) {
          lastSeenMessageAtRef.current[conversationId] = lastAt;
          const syntheticMessage = buildSyntheticUserMessage(conversation, lastAt);
          emitRealtimeEvent({
            type: "message.created",
            conversationId,
            conversation,
            message: syntheticMessage,
          });
        }
      }
    } catch {
      // ignore polling errors
    }
  }, [isAdmin, roleLoading]);

  useEffect(() => {
    syncFromConversationsCache();
    return queryClient.getQueryCache().subscribe((event) => {
      if (event?.query.queryKey[0] === "conversations" && event?.query.queryKey[1] === "list") {
        syncFromConversationsCache();
      }
    });
  }, [queryClient, syncFromConversationsCache]);

  useEffect(() => {
    if (roleLoading || isAdmin) return undefined;

    void pollInboxConversations();
    const intervalMs = connected ? 20_000 : 8_000;
    const interval = window.setInterval(() => {
      void pollInboxConversations();
    }, intervalMs);

    return () => window.clearInterval(interval);
  }, [connected, isAdmin, pollInboxConversations, roleLoading]);

  useEffect(() => {
    return subscribeRealtimeEvents((event) => {
      if (event.type === "message.created") {
        handleUserMessage(event.conversation, event.message);
        return;
      }

      if (event.type === "conversation.handoff") {
        if (event.conversation.conversationId === activeConversationIdRef.current) return;

        setCounts((current) => {
          const next = {
            ...current,
            [event.conversation.conversationId]: Math.max(
              current[event.conversation.conversationId] ?? 0,
              1
            ),
          };
          saveUnreadCounts(scopeRef.current, next);
          return next;
        });

        const label = conversationLabel(event.conversation);
        const href = conversationHref(event.conversation, { advisorMode: isAdvisor });
        const title = t("notifications.types.handoff", { name: label });
        const body = t("notifications.handoffBody");

        if (document.hidden) {
          showBrowserNotification(title, body, href);
        } else {
          if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
          setToast({
            id: `handoff-${event.conversation.conversationId}-${event.conversation.handoffAt ?? Date.now()}`,
            title,
            body,
            href,
          });
          toastTimerRef.current = setTimeout(() => setToast(null), 6_000);
        }
      }
    });
  }, [handleUserMessage, isAdvisor, t]);

  const setActiveConversationId = useCallback((conversationId: string | null) => {
    activeConversationIdRef.current = conversationId;
  }, []);

  const markConversationRead = useCallback(
    (
      conversationId: string,
      botId?: string,
      workflowStatus?: string,
      lastMessageAt?: string
    ) => {
      if (lastMessageAt) {
        lastSeenMessageAtRef.current[conversationId] = lastMessageAt;
      }

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
