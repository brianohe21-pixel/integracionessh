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
import { useSoftphoneToken, useUpdatePresence } from "@/hooks/useContactCenter";
import { useTenantRole } from "@/hooks/useTenantRole";

type SoftphoneStatus = "idle" | "connecting" | "ready" | "ringing" | "active" | "error";

interface IncomingCall {
  id: string;
  from?: string;
  answer: () => void;
  hangup: () => void;
  mute: (muted: boolean) => void;
}

interface SoftphoneContextValue {
  status: SoftphoneStatus;
  incoming: IncomingCall | null;
  muted: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  setAvailable: (available: boolean) => Promise<void>;
  answer: () => void;
  reject: () => void;
  hangup: () => void;
  toggleMute: () => void;
}

const SoftphoneContext = createContext<SoftphoneContextValue | null>(null);

type TelnyxNotification = {
  type?: string;
  call?: {
    id?: string;
    state?: string;
    options?: { callerNumber?: string };
    answer?: () => void;
    hangup?: () => void;
    muteAudio?: () => void;
    unmuteAudio?: () => void;
  };
};

type TelnyxRtcClient = {
  connect: () => void;
  disconnect: () => void;
  on: (event: string, cb: (notification: TelnyxNotification) => void) => void;
  off?: (event: string, cb: (notification: TelnyxNotification) => void) => void;
};

function safeDisconnect(client: { disconnect?: () => void } | null) {
  try {
    client?.disconnect?.();
  } catch {
    return;
  }
}

export function SoftphoneProvider({ children }: { children: ReactNode }) {
  const { role } = useTenantRole();
  const tokenMutation = useSoftphoneToken();
  const presenceMutation = useUpdatePresence();
  const clientRef = useRef<TelnyxRtcClient | null>(null);
  const [status, setStatus] = useState<SoftphoneStatus>("idle");
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const heartbeatRef = useRef<number | null>(null);

  const disconnect = useCallback(() => {
    if (heartbeatRef.current) window.clearInterval(heartbeatRef.current);
    heartbeatRef.current = null;
    safeDisconnect(clientRef.current);
    clientRef.current = null;
    setIncoming(null);
    setStatus("idle");
    void presenceMutation.mutateAsync({ state: "offline", webrtcConnected: false });
  }, [presenceMutation]);

  const connect = useCallback(async () => {
    setError(null);
    setStatus("connecting");
    try {
      const token = await tokenMutation.mutateAsync();
      const mod = await import("@telnyx/webrtc");
      const TelnyxRTC = (mod as { TelnyxRTC: new (opts: { login_token: string }) => TelnyxRtcClient }).TelnyxRTC;
      const client = new TelnyxRTC({ login_token: token.loginToken });
      clientRef.current = client;
      client.on("telnyx.ready", () => {
        setStatus("ready");
        void presenceMutation.mutateAsync({ state: "available", webrtcConnected: true });
      });
      client.on("telnyx.error", () => {
        setStatus("error");
        setError("Telnyx WebRTC error");
      });
      client.on("telnyx.notification", (notification) => {
        const call = notification.call;
        if (!call) return;
        if (call.state === "ringing" || call.state === "new") {
          const wrapped: IncomingCall = {
            id: String(call.id ?? "call"),
            from: call.options?.callerNumber,
            answer: () => call.answer?.(),
            hangup: () => call.hangup?.(),
            mute: (next) => {
              if (next) call.muteAudio?.();
              else call.unmuteAudio?.();
            },
          };
          setIncoming(wrapped);
          setStatus("ringing");
        }
        if (call.state === "active") {
          setStatus("active");
        }
        if (call.state === "hangup" || call.state === "destroy" || call.state === "purge") {
          setIncoming(null);
          setStatus("ready");
          setMuted(false);
        }
      });
      client.connect();
      heartbeatRef.current = window.setInterval(() => {
        void presenceMutation.mutateAsync({ webrtcConnected: true });
      }, 15000);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Softphone error");
    }
  }, [presenceMutation, tokenMutation]);

  const setAvailable = useCallback(
    async (available: boolean) => {
      await presenceMutation.mutateAsync({
        state: available ? "available" : "break",
        webrtcConnected: status === "ready" || status === "active" || status === "ringing",
      });
    },
    [presenceMutation, status]
  );

  useEffect(() => {
    return () => {
      if (heartbeatRef.current) window.clearInterval(heartbeatRef.current);
      safeDisconnect(clientRef.current);
    };
  }, []);

  const value = useMemo<SoftphoneContextValue>(
    () => ({
      status,
      incoming,
      muted,
      error,
      connect,
      disconnect,
      setAvailable,
      answer: () => {
        incoming?.answer();
        setStatus("active");
      },
      reject: () => {
        incoming?.hangup();
        setIncoming(null);
        setStatus("ready");
      },
      hangup: () => {
        incoming?.hangup();
        setIncoming(null);
        setStatus("ready");
      },
      toggleMute: () => {
        const next = !muted;
        incoming?.mute(next);
        setMuted(next);
      },
    }),
    [connect, disconnect, incoming, muted, setAvailable, status, error]
  );

  if (role !== "advisor" && role !== "member") {
    return <>{children}</>;
  }

  return <SoftphoneContext.Provider value={value}>{children}</SoftphoneContext.Provider>;
}

export function useSoftphone(): SoftphoneContextValue {
  const ctx = useContext(SoftphoneContext);
  if (!ctx) {
    return {
      status: "idle",
      incoming: null,
      muted: false,
      error: null,
      connect: async () => undefined,
      disconnect: () => undefined,
      setAvailable: async () => undefined,
      answer: () => undefined,
      reject: () => undefined,
      hangup: () => undefined,
      toggleMute: () => undefined,
    };
  }
  return ctx;
}
