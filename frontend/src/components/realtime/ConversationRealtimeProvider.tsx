"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { fetchAuthSession } from "aws-amplify/auth";
import type { Conversation, ConversationsListResponse, Message } from "@/types";
import { parseRealtimeEvent } from "@/lib/realtime/events";
import { RealtimeProvider } from "@/components/realtime/RealtimeProvider";

const WS_BASE_URL = (process.env.NEXT_PUBLIC_WS_URL ?? "").replace(/\/$/, "");
const MIN_RECONNECT_MS = 1_000;
const MAX_RECONNECT_MS = 30_000;

function mergeConversationInList(
  data: InfiniteData<ConversationsListResponse> | undefined,
  conversation: Conversation
): InfiniteData<ConversationsListResponse> | undefined {
  if (!data) return data;

  const pages = data.pages.map((page) => ({ ...page, items: [...page.items] }));
  let merged: Conversation | null = null;

  for (const page of pages) {
    const index = page.items.findIndex((item) => item.conversationId === conversation.conversationId);
    if (index >= 0) {
      merged = { ...page.items[index], ...conversation };
      page.items.splice(index, 1);
    }
  }

  const nextConversation = merged ?? conversation;
  if (pages.length === 0) {
    return { ...data, pages: [{ items: [nextConversation] }] };
  }

  pages[0] = {
    ...pages[0],
    items: [nextConversation, ...pages[0].items],
  };

  return { ...data, pages };
}

function appendMessage(
  messages: Message[] | undefined,
  message: Message
): Message[] {
  if (!messages) return [message];
  if (messages.some((item) => item.messageId === message.messageId)) return messages;
  return [...messages, message];
}

function notifyHandoff(conversation: Conversation) {
  if (typeof window === "undefined" || !document.hidden) return;
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

  const label = conversation.contactName ?? conversation.phoneNumber ?? conversation.conversationId;
  new Notification("Nueva conversación asignada", {
    body: `${label} requiere atención humana`,
  });
}

function ConversationRealtimeInner({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef(MIN_RECONNECT_MS);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    if (!WS_BASE_URL) return undefined;

    async function connect() {
      if (!mountedRef.current) return;

      try {
        const session = await fetchAuthSession();
        const token = session.tokens?.idToken?.toString();
        if (!token) {
          scheduleReconnect();
          return;
        }

        const socket = new WebSocket(`${WS_BASE_URL}?token=${encodeURIComponent(token)}`);
        socketRef.current = socket;

        socket.onopen = () => {
          if (!mountedRef.current) return;
          reconnectDelayRef.current = MIN_RECONNECT_MS;
          setConnected(true);
        };

        socket.onmessage = (event) => {
          const parsed = parseRealtimeEvent(String(event.data));
          if (!parsed) return;

          if (parsed.type === "message.created") {
            queryClient.setQueryData<Message[]>(
              ["conversation-messages", parsed.conversationId],
              (current) => appendMessage(current, parsed.message)
            );
            queryClient.setQueriesData<InfiniteData<ConversationsListResponse>>(
              { queryKey: ["conversations", "list"] },
              (current) => mergeConversationInList(current, parsed.conversation)
            );
            return;
          }

          if (parsed.type === "conversation.handoff") {
            notifyHandoff(parsed.conversation);
          }

          queryClient.setQueriesData<InfiniteData<ConversationsListResponse>>(
            { queryKey: ["conversations", "list"] },
            (current) => mergeConversationInList(current, parsed.conversation)
          );
        };

        socket.onclose = () => {
          if (!mountedRef.current) return;
          setConnected(false);
          socketRef.current = null;
          scheduleReconnect();
        };

        socket.onerror = () => {
          socket.close();
        };
      } catch {
        scheduleReconnect();
      }
    }

    function scheduleReconnect() {
      if (!mountedRef.current) return;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = setTimeout(() => {
        reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 2, MAX_RECONNECT_MS);
        void connect();
      }, reconnectDelayRef.current);
    }

    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      void Notification.requestPermission();
    }

    void connect();

    const keepAlive = window.setInterval(() => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send("ping");
      }
    }, 60_000);

    return () => {
      mountedRef.current = false;
      window.clearInterval(keepAlive);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      socketRef.current?.close();
      socketRef.current = null;
      setConnected(false);
    };
  }, [queryClient]);

  return <RealtimeProvider connected={connected}>{children}</RealtimeProvider>;
}

export function ConversationRealtimeProvider({ children }: { children: React.ReactNode }) {
  return <ConversationRealtimeInner>{children}</ConversationRealtimeInner>;
}
