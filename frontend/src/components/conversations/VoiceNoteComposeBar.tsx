"use client";

import { Square, Trash2 } from "lucide-react";
import { ChatAudioPlayer } from "@/components/conversations/ChatAudioPlayer";
import { LiveAudioWaveform } from "@/components/conversations/LiveAudioWaveform";
import { formatRecordingDuration } from "@/lib/conversations/audio-recording";
import { useT } from "@/i18n/context";
import type { useVoiceNoteRecorder } from "@/hooks/useVoiceNoteRecorder";

type VoiceState = ReturnType<typeof useVoiceNoteRecorder>;

type Props = {
  voice: VoiceState;
  sending?: boolean;
};

export function VoiceNoteComposeBar({ voice, sending = false }: Props) {
  const t = useT();

  if (voice.recording) {
    return (
      <div className="flex min-h-[48px] items-center gap-2.5 px-3 py-2">
        <div className="flex w-11 flex-shrink-0 items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
          <span className="text-xs font-semibold tabular-nums text-red-500">
            {formatRecordingDuration(voice.elapsedMs)}
          </span>
        </div>

        <LiveAudioWaveform stream={voice.activeStream} active={voice.recording} variant="inline" />

        <button
          type="button"
          onClick={voice.cancelRecording}
          disabled={sending}
          aria-label={t("conversations.voiceNoteCancel")}
          className="conversations-compose-action flex-shrink-0"
        >
          <Trash2 className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={voice.stopRecording}
          disabled={sending}
          aria-label={t("conversations.voiceNoteStop")}
          className="conversations-compose-action flex-shrink-0 text-red-500"
        >
          <Square className="h-4 w-4 fill-current" />
        </button>
      </div>
    );
  }

  if (voice.previewUrl) {
    return (
      <div className="flex min-h-[48px] items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={voice.cancelRecording}
          disabled={sending}
          aria-label={t("conversations.voiceNoteCancel")}
          className="conversations-compose-action flex-shrink-0"
        >
          <Trash2 className="h-4 w-4" />
        </button>

        <ChatAudioPlayer src={voice.previewUrl} variant="inline" className="min-w-0 flex-1" />
      </div>
    );
  }

  return null;
}
