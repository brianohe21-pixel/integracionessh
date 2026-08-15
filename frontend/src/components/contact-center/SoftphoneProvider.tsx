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
import { useT } from "@/i18n/context";

type SoftphoneStatus =
  | "idle"
  | "connecting"
  | "ready"
  | "dialing"
  | "ringing"
  | "active"
  | "error";

type CallDirection = "inbound" | "outbound";

interface LiveCall {
  id: string;
  direction: CallDirection;
  remote?: string;
  answer: () => void;
  hangup: () => void;
  mute: (muted: boolean) => void;
}

interface SoftphoneContextValue {
  status: SoftphoneStatus;
  incoming: LiveCall | null;
  callDirection: CallDirection | null;
  muted: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  dial: (params: { to: string; callerNumber: string; clientState: string }) => void;
  setAvailable: (available: boolean) => Promise<void>;
  answer: () => void;
  reject: () => void;
  hangup: () => void;
  toggleMute: () => void;
}

const SoftphoneContext = createContext<SoftphoneContextValue | null>(null);

type TelnyxAnswerOptions = {
  audio?: boolean;
  remoteElement?: HTMLMediaElement | string;
};

type TelnyxCall = {
  id?: string;
  state?: string;
  options?: { callerNumber?: string; destinationNumber?: string };
  answer?: (options?: TelnyxAnswerOptions) => void;
  hangup?: () => void;
  muteAudio?: () => void;
  unmuteAudio?: () => void;
};

type TelnyxNotification = {
  type?: string;
  call?: TelnyxCall;
};

type TelnyxRtcClient = {
  connect: () => void;
  disconnect: () => void;
  remoteElement?: HTMLMediaElement | string;
  enableMicrophone?: () => void;
  newCall?: (options: {
    destinationNumber: string;
    callerNumber?: string;
    clientState?: string;
    audio?: boolean;
    remoteElement?: HTMLMediaElement | string;
  }) => TelnyxCall;
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

function wrapCall(call: TelnyxCall, direction: CallDirection, audioRef: HTMLAudioElement | null): LiveCall {
  return {
    id: String(call.id ?? "call"),
    direction,
    remote:
      direction === "inbound"
        ? call.options?.callerNumber
        : call.options?.destinationNumber,
    answer: () =>
      call.answer?.({
        audio: true,
        ...(audioRef ? { remoteElement: audioRef } : {}),
      }),
    hangup: () => call.hangup?.(),
    mute: (next) => {
      if (next) call.muteAudio?.();
      else call.unmuteAudio?.();
    },
  };
}

export function SoftphoneProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const { role } = useTenantRole();
  const tokenMutation = useSoftphoneToken();
  const presenceMutation = useUpdatePresence();
  const clientRef = useRef<TelnyxRtcClient | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const outboundDialRef = useRef(false);
  const [status, setStatus] = useState<SoftphoneStatus>("idle");
  const [liveCall, setLiveCall] = useState<LiveCall | null>(null);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const heartbeatRef = useRef<number | null>(null);

  const disconnect = useCallback(() => {
    if (heartbeatRef.current) window.clearInterval(heartbeatRef.current);
    heartbeatRef.current = null;
    safeDisconnect(clientRef.current);
    clientRef.current = null;
    outboundDialRef.current = false;
    setLiveCall(null);
    setStatus("idle");
    void presenceMutation.mutateAsync({ state: "offline", webrtcConnected: false });
  }, [presenceMutation]);

  const connect = useCallback(async () => {
    setError(null);
    setStatus("connecting");
    try {
      const token = await tokenMutation.mutateAsync();
      try {
        const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
        mic.getTracks().forEach((track) => track.stop());
      } catch {
        setStatus("error");
        setError(t("contactCenter.micDenied"));
        return;
      }
      const mod = await import("@telnyx/webrtc");
      const TelnyxRTC = (mod as { TelnyxRTC: new (opts: { login_token: string }) => TelnyxRtcClient }).TelnyxRTC;
      const client = new TelnyxRTC({ login_token: token.loginToken });
      if (audioRef.current) client.remoteElement = audioRef.current;
      client.enableMicrophone?.();
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

        const direction: CallDirection = outboundDialRef.current ? "outbound" : "inbound";

        if (
          call.state === "ringing" ||
          call.state === "new" ||
          call.state === "trying" ||
          call.state === "requesting"
        ) {
          const wrapped = wrapCall(call, direction, audioRef.current);
          setLiveCall(wrapped);
          setStatus(direction === "outbound" ? "dialing" : "ringing");
        }
        if (call.state === "active") {
          setStatus("active");
          void audioRef.current?.play().catch(() => undefined);
        }
        if (call.state === "hangup" || call.state === "destroy" || call.state === "purge") {
          outboundDialRef.current = false;
          setLiveCall(null);
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
  }, [presenceMutation, tokenMutation, t]);

  const dial = useCallback(
    (params: { to: string; callerNumber: string; clientState: string }) => {
      const client = clientRef.current;
      if (!client?.newCall) {
        setError(t("contactCenter.dialConnectFirst"));
        return;
      }
      setError(null);
      outboundDialRef.current = true;
      client.newCall({
        destinationNumber: params.to,
        callerNumber: params.callerNumber,
        clientState: params.clientState,
        audio: true,
        ...(audioRef.current ? { remoteElement: audioRef.current } : {}),
      });
      setStatus("dialing");
    },
    [t]
  );

  const setAvailable = useCallback(
    async (available: boolean) => {
      await presenceMutation.mutateAsync({
        state: available ? "available" : "break",
        webrtcConnected: status === "ready" || status === "active" || status === "ringing" || status === "dialing",
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
      incoming: liveCall,
      callDirection: liveCall?.direction ?? null,
      muted,
      error,
      connect,
      disconnect,
      dial,
      setAvailable,
      answer: () => {
        liveCall?.answer();
        setStatus("active");
        void audioRef.current?.play().catch(() => undefined);
      },
      reject: () => {
        liveCall?.hangup();
        outboundDialRef.current = false;
        setLiveCall(null);
        setStatus("ready");
      },
      hangup: () => {
        liveCall?.hangup();
        outboundDialRef.current = false;
        setLiveCall(null);
        setStatus("ready");
      },
      toggleMute: () => {
        const next = !muted;
        liveCall?.mute(next);
        setMuted(next);
      },
    }),
    [connect, disconnect, dial, liveCall, muted, setAvailable, status, error]
  );

  if (role !== "advisor" && role !== "member") {
    return <>{children}</>;
  }

  return (
    <SoftphoneContext.Provider value={value}>
      <audio ref={audioRef} autoPlay playsInline />
      {children}
    </SoftphoneContext.Provider>
  );
}

export function useSoftphone(): SoftphoneContextValue {
  const ctx = useContext(SoftphoneContext);
  if (!ctx) {
    return {
      status: "idle",
      incoming: null,
      callDirection: null,
      muted: false,
      error: null,
      connect: async () => undefined,
      disconnect: () => undefined,
      dial: () => undefined,
      setAvailable: async () => undefined,
      answer: () => undefined,
      reject: () => undefined,
      hangup: () => undefined,
      toggleMute: () => undefined,
    };
  }
  return ctx;
}
