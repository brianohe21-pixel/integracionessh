"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createWebchatSession,
  endWebchatSession,
  pollWebchatMessages,
  requestWebchatHandoff,
  sendWebchatMessage,
  type WebchatMessage,
} from "@/lib/webchat-client";

export interface WebchatTestMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
}

function toDisplayMessage(msg: WebchatMessage): WebchatTestMessage | null {
  if (msg.messageType === "call_invite" || msg.messageType === "call_ended") {
    return null;
  }
  if (msg.role === "user") {
    return {
      id: msg.messageId,
      role: "user",
      content: msg.content,
      timestamp: msg.timestamp,
    };
  }
  if (msg.role === "assistant" || msg.role === "advisor" || msg.role === "bot") {
    return {
      id: msg.messageId,
      role: "assistant",
      content: msg.content,
      timestamp: msg.timestamp,
    };
  }
  if (msg.role === "system") {
    return {
      id: msg.messageId,
      role: "system",
      content: msg.content,
      timestamp: msg.timestamp,
    };
  }
  return null;
}

export function useWebchatTest(params: {
  botId: string;
  widgetKey?: string;
  enabled: boolean;
}) {
  const [messages, setMessages] = useState<WebchatTestMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "ready" | "sending" | "error">("idle");
  const [error, setError] = useState("");
  const [sessionEnded, setSessionEnded] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [sessionVersion, setSessionVersion] = useState(0);
  const sessionRef = useRef<{ sessionId: string; sessionToken: string } | null>(null);
  const seenRef = useRef<Set<string>>(new Set());

  const mergeMessages = useCallback((incoming: WebchatMessage[]) => {
    const next: WebchatTestMessage[] = [];
    for (const item of incoming) {
      const key = `${item.messageId}:${item.timestamp}`;
      if (seenRef.current.has(key)) continue;
      const mapped = toDisplayMessage(item);
      if (!mapped) continue;
      seenRef.current.add(key);
      next.push(mapped);
    }
    if (next.length > 0) {
      setMessages((prev) => [...prev, ...next]);
    }
  }, []);

  const ensureSession = useCallback(async () => {
    if (sessionRef.current && !sessionEnded) return sessionRef.current;
    if (!params.widgetKey) {
      throw new Error("Missing widget key");
    }
    setStatus("connecting");
    const session = await createWebchatSession({
      botId: params.botId,
      widgetKey: params.widgetKey,
      visitorName: "Test visitor",
    });
    sessionRef.current = {
      sessionId: session.sessionId,
      sessionToken: session.sessionToken,
    };
    setConversationId(session.conversationId);
    setSessionEnded(false);
    setStatus("ready");
    return sessionRef.current;
  }, [params.botId, params.widgetKey, sessionEnded]);

  const poll = useCallback(async () => {
    const session = sessionRef.current;
    if (!session || sessionEnded) return;
    const result = await pollWebchatMessages(session);
    if (result.sessionStatus === "ended") {
      setSessionEnded(true);
    }
    mergeMessages(result.items);
  }, [mergeMessages, sessionEnded]);

  useEffect(() => {
    if (!params.enabled || !params.widgetKey) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    void ensureSession()
      .then(() => {
        if (cancelled) return;
        void poll();
        timer = setInterval(() => {
          void poll().catch(() => {});
        }, 2500);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setStatus("error");
        setError(err.message);
      });

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [ensureSession, params.enabled, params.widgetKey, poll, sessionVersion]);

  async function send(content: string) {
    const trimmed = content.trim();
    if (!trimmed || sessionEnded) return;
    setError("");
    try {
      const session = await ensureSession();
      setStatus("sending");
      const optimisticId = `local-${Date.now()}`;
      seenRef.current.add(`${optimisticId}:${new Date().toISOString()}`);
      setMessages((prev) => [
        ...prev,
        {
          id: optimisticId,
          role: "user",
          content: trimmed,
          timestamp: new Date().toISOString(),
        },
      ]);
      await sendWebchatMessage({
        sessionId: session.sessionId,
        sessionToken: session.sessionToken,
        content: trimmed,
      });
      await poll();
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to send message");
    }
  }

  async function endConversation() {
    const session = sessionRef.current;
    if (!session || sessionEnded || actionPending) return;
    setActionPending(true);
    setError("");
    try {
      const result = await endWebchatSession(session);
      if (result.farewellMessage) {
        const farewellId = `farewell-${Date.now()}`;
        seenRef.current.add(`${farewellId}:${new Date().toISOString()}`);
        setMessages((prev) => [
          ...prev,
          {
            id: farewellId,
            role: "assistant",
            content: result.farewellMessage ?? "",
            timestamp: new Date().toISOString(),
          },
        ]);
      }
      setSessionEnded(true);
      setStatus("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to end conversation");
    } finally {
      setActionPending(false);
    }
  }

  async function requestHandoff() {
    const session = sessionRef.current;
    if (!session || sessionEnded || actionPending) return;
    setActionPending(true);
    setError("");
    try {
      const result = await requestWebchatHandoff(session);
      const messageId = `handoff-${Date.now()}`;
      seenRef.current.add(`${messageId}:${new Date().toISOString()}`);
      setMessages((prev) => [
        ...prev,
        {
          id: messageId,
          role: "assistant",
          content: result.message,
          timestamp: new Date().toISOString(),
        },
      ]);
      await poll();
      setStatus("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to request handoff");
    } finally {
      setActionPending(false);
    }
  }

  function reset() {
    sessionRef.current = null;
    seenRef.current.clear();
    setMessages([]);
    setConversationId(null);
    setError("");
    setSessionEnded(false);
    setActionPending(false);
    setStatus("idle");
    setSessionVersion((value) => value + 1);
  }

  function startNewConversation() {
    reset();
  }

  return {
    messages,
    conversationId,
    status,
    error,
    sessionEnded,
    actionPending,
    send,
    reset,
    poll,
    endConversation,
    requestHandoff,
    startNewConversation,
  };
}
