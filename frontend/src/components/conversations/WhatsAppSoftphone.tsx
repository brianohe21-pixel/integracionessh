"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Phone, PhoneOff } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
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
          to: conversation.phoneNumber,
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

  return (
    <div className="border-b border-gray-200 bg-violet-50 px-4 py-3">
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-900">{t("softphone.title")}</p>
          <p className="text-xs text-gray-500">
            {status === "idle" && t("softphone.stateIdle")}
            {status === "calling" && t("softphone.stateCalling")}
            {status === "in_call" && t("softphone.stateInCall")}
            {status === "ended" && t("softphone.stateEnded")}
          </p>
          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        </div>
        <div className="flex items-center gap-2">
          {!inCall && (
            <button
              type="button"
              onClick={() => initiate.mutate()}
              disabled={!advisorMode || initiate.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-violet-600 text-white disabled:opacity-50"
            >
              <Phone className="w-3.5 h-3.5" />
              {t("softphone.call")}
            </button>
          )}
          {status === "calling" && callId && (
            <button
              type="button"
              onClick={() => acceptAnswer.mutate(callId)}
              disabled={acceptAnswer.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-green-600 text-white"
            >
              {t("softphone.connect")}
            </button>
          )}
          {inCall && (
            <button
              type="button"
              onClick={() => hangUp.mutate()}
              disabled={hangUp.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-600 text-white"
            >
              <PhoneOff className="w-3.5 h-3.5" />
              {t("softphone.hangUp")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
