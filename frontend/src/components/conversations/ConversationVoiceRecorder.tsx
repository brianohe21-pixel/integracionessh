"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Send, Square, Trash2 } from "lucide-react";
import {
  buildVoiceNoteFile,
  createVoiceNoteRecorder,
  formatRecordingDuration,
  VOICE_NOTE_MAX_DURATION_MS,
} from "@/lib/conversations/audio-recording";
import { useT } from "@/i18n/context";
import { cn } from "@/lib/utils";

type Props = {
  disabled?: boolean;
  sending?: boolean;
  onSendVoiceNote: (file: File) => void | Promise<void>;
  onMicDenied?: () => void;
};

export function ConversationVoiceRecorder({
  disabled = false,
  sending = false,
  onSendVoiceNote,
  onMicDenied,
}: Props) {
  const t = useT();
  const [recording, setRecording] = useState(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [starting, setStarting] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      stopTracks();
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
      }
    };
  }, []);

  function stopTracks() {
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  async function startRecording() {
    if (disabled || sending || starting || recording || previewBlob) return;

    setStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = createVoiceNoteRecorder(stream);
      chunksRef.current = [];
      streamRef.current = stream;
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/ogg" });
        setPreviewBlob(blob);
        setRecording(false);
        stopTracks();
        if (timerRef.current !== null) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };

      recorder.start(250);
      startedAtRef.current = Date.now();
      setElapsedMs(0);
      setRecording(true);
      timerRef.current = window.setInterval(() => {
        const nextElapsed = Date.now() - startedAtRef.current;
        setElapsedMs(nextElapsed);
        if (nextElapsed >= VOICE_NOTE_MAX_DURATION_MS) {
          stopRecording();
        }
      }, 250);
    } catch {
      stopTracks();
      onMicDenied?.();
    } finally {
      setStarting(false);
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
  }

  function cancelRecording() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
    }
    chunksRef.current = [];
    setPreviewBlob(null);
    setRecording(false);
    setElapsedMs(0);
    stopTracks();
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function sendVoiceNote() {
    if (!previewBlob || sending) return;
    await onSendVoiceNote(buildVoiceNoteFile(previewBlob));
    setPreviewBlob(null);
    setElapsedMs(0);
  }

  if (previewBlob) {
    return (
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={cancelRecording}
          disabled={sending}
          aria-label={t("conversations.voiceNoteCancel")}
          className="conversations-compose-action"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => void sendVoiceNote()}
          disabled={sending}
          aria-label={t("conversations.voiceNoteSend")}
          className={cn(
            "conversations-compose-action text-accent",
            sending && "opacity-70"
          )}
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    );
  }

  if (recording) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-red-500">
          {formatRecordingDuration(elapsedMs)}
        </span>
        <button
          type="button"
          onClick={cancelRecording}
          disabled={sending}
          aria-label={t("conversations.voiceNoteCancel")}
          className="conversations-compose-action"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={stopRecording}
          disabled={sending}
          aria-label={t("conversations.voiceNoteStop")}
          className="conversations-compose-action text-red-500"
        >
          <Square className="h-4 w-4 fill-current" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void startRecording()}
      disabled={disabled || sending || starting}
      aria-label={t("conversations.voiceNoteRecord")}
      className="conversations-compose-action"
    >
      {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
    </button>
  );
}
