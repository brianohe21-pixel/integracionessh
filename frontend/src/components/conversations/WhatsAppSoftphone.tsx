"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Phone, PhoneOff } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { normalizeWhatsAppPhone } from "@/lib/wa-link";
import { useT } from "@/i18n/context";
import type { Conversation } from "@/types";

type Props = {
  conversation: Conversation;
  advisorMode?: boolean;
};

export function WhatsAppSoftphone({ conversation, advisorMode = false }: Props) {
  const t = useT();
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const [callId, setCallId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "calling" | "in_call" | "ended">("idle");
  const [error, setError] = useState<string | null>(null);

  const cleanup = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const initiate = useMutation({
    mutationFn: async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      pcRef.current = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        const el = remoteAudioRef.current;
        if (el && event.streams[0]) {
          el.srcObject = event.streams[0];
          void el.play().catch(() => undefined);
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const response = await api.post<{ callId: string }>(
        `/bots/${encodeURIComponent(conversation.botId)}/calling/calls/initiate`,
        {
          to: normalizeWhatsAppPhone(conversation.phoneNumber),
          session: {
            sdp_type: "offer",
            sdp: offer.sdp ?? "",
          },
        }
      );

      setCallId(response.callId);
      setStatus("calling");
      return response.callId;
    },
    onError: (err: Error) => {
      setError(err.message);
      cleanup();
      setStatus("idle");
    },
  });

  const acceptAnswer = useMutation({
    mutationFn: async (incomingCallId: string) => {
      const pc = pcRef.current;
      if (!pc) throw new Error("No peer connection");

      await api.post(
        `/bots/${encodeURIComponent(conversation.botId)}/calling/calls/${encodeURIComponent(incomingCallId)}/action`,
        {
          action: "accept",
          session: {
            sdp_type: "answer",
            sdp: pc.localDescription?.sdp ?? "",
          },
        }
      );

      setStatus("in_call");
    },
    onError: (err: Error) => setError(err.message),
  });

  const hangUp = useMutation({
    mutationFn: async () => {
      if (callId) {
        await api.post(
          `/bots/${encodeURIComponent(conversation.botId)}/calling/calls/${encodeURIComponent(callId)}/action`,
          { action: "terminate" }
        );
      }
    },
    onSettled: () => {
      cleanup();
      setCallId(null);
      setStatus("ended");
      setTimeout(() => setStatus("idle"), 1500);
    },
  });

  if ((conversation.channel ?? "whatsapp") !== "whatsapp") return null;
  if (conversation.handoffMode !== "human") return null;

  const inCall = status === "in_call" || status === "calling";
  const showFullBar = inCall || status === "ended" || Boolean(error);

  if (!showFullBar) {
    return (
      <div className="flex items-center justify-end gap-2 border-b border-default px-4 py-1.5 sm:px-6">
        <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => initiate.mutate()}
          disabled={!advisorMode || initiate.isPending}
          className="text-accent hover:bg-accent-muted hover:text-accent"
        >
          <Phone className="h-3.5 w-3.5" />
          {t("softphone.call")}
        </Button>
      </div>
    );
  }

  return (
    <div className="conversations-softphone border-b border-default px-4 py-2.5 sm:px-6">
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-muted text-accent">
            <Phone className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-primary">{t("softphone.title")}</p>
            <p className="text-xs text-secondary">
              {status === "calling" && t("softphone.stateCalling")}
              {status === "in_call" && t("softphone.stateInCall")}
              {status === "ended" && t("softphone.stateEnded")}
            </p>
            {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {status === "calling" && callId ? (
            <Button
              type="button"
              size="sm"
              onClick={() => acceptAnswer.mutate(callId)}
              disabled={acceptAnswer.isPending}
            >
              {t("softphone.connect")}
            </Button>
          ) : null}
          {inCall ? (
            <Button
              type="button"
              size="sm"
              variant="danger"
              onClick={() => hangUp.mutate()}
              disabled={hangUp.isPending}
            >
              <PhoneOff className="h-3.5 w-3.5" />
              {t("softphone.hangUp")}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
