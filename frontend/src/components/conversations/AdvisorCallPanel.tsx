"use client";

import { useEffect, useRef } from "react";
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from "lucide-react";
import { useT } from "@/i18n/context";
import { useLiveKitCall } from "@/hooks/useLiveKitCall";
import type { Conversation } from "@/types";

type Props = {
  conversation: Conversation;
  advisorMode?: boolean;
  voiceEnabled?: boolean;
};

export function AdvisorCallPanel({ conversation, voiceEnabled = true }: Props) {
  const t = useT();
  const audioRef = useRef<HTMLAudioElement>(null);
  const channel = conversation.channel ?? "whatsapp";
  const isWebchat = channel === "webchat";
  const isHuman = conversation.handoffMode === "human";
  const canCall = isWebchat && isHuman && voiceEnabled;

  const { callState, attachRemoteAudio, ...liveKit } = useLiveKitCall({
    conversationId: conversation.conversationId,
    botId: conversation.botId,
    enabled: canCall && Boolean(conversation.conversationId),
  });

  useEffect(() => {
    if (callState === "in_call") {
      attachRemoteAudio(audioRef.current);
    }
  }, [callState, attachRemoteAudio]);

  if (!canCall) return null;

  const inCall = callState === "in_call" || callState === "connecting";
  const ringing = callState === "ringing";

  return (
    <div className="border-b border-default bg-slate-50 px-4 py-3">
      <audio ref={audioRef} autoPlay playsInline className="hidden" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-primary">{t("livekit.panelTitle")}</p>
          <p className="text-xs text-secondary">
            {callState === "idle" && t("livekit.stateIdle")}
            {ringing && t("livekit.stateRinging")}
            {callState === "connecting" && t("livekit.stateConnecting")}
            {inCall && t("livekit.stateInCall")}
            {callState === "ended" && t("livekit.stateEnded")}
          </p>
          {liveKit.error && <p className="text-xs text-red-600 mt-1">{liveKit.error}</p>}
        </div>

        <div className="flex items-center gap-2">
          {!inCall && !ringing && (
            <button
              type="button"
              onClick={() => liveKit.startCall.mutate()}
              disabled={liveKit.startCall.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700"
            >
              <Phone className="w-3.5 h-3.5" />
              {t("livekit.startCall")}
            </button>
          )}

          {ringing && liveKit.activeCall && (
            <button
              type="button"
              onClick={() => liveKit.joinCall.mutate(liveKit.activeCall!)}
              disabled={liveKit.joinCall.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-green-600 text-white"
            >
              <Phone className="w-3.5 h-3.5" />
              {t("livekit.rejoin")}
            </button>
          )}

          {inCall && (
            <>
              <button
                type="button"
                onClick={() => void liveKit.toggleMute()}
                className="p-2 rounded-lg bg-surface-elevated border border-default text-secondary"
                title={liveKit.muted ? t("livekit.unmute") : t("livekit.mute")}
              >
                {liveKit.muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              {liveKit.allowVideo && (
                <button
                  type="button"
                  onClick={() => void liveKit.toggleVideo()}
                  className="p-2 rounded-lg bg-surface-elevated border border-default text-secondary"
                >
                  {liveKit.cameraOn ? (
                    <Video className="w-4 h-4" />
                  ) : (
                    <VideoOff className="w-4 h-4" />
                  )}
                </button>
              )}
            </>
          )}

          {(inCall || ringing) && (
            <button
              type="button"
              onClick={() => liveKit.endCall.mutate()}
              disabled={liveKit.endCall.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-600 text-white"
            >
              <PhoneOff className="w-3.5 h-3.5" />
              {t("livekit.endCall")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
