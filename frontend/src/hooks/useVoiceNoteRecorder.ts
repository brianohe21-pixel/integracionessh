"use client";

import { useEffect, useRef, useState } from "react";
import {
  buildVoiceNoteFile,
  createVoiceNoteRecorder,
  isValidOggBlob,
  VOICE_NOTE_MAX_DURATION_MS,
  VOICE_NOTE_MIN_DURATION_MS,
} from "@/lib/conversations/audio-recording";

type Options = {
  disabled?: boolean;
  sending?: boolean;
  onSendVoiceNote: (file: File) => void | Promise<void>;
  onMicDenied?: () => void;
  onInvalidRecording?: () => void;
};

export function useVoiceNoteRecorder({
  disabled = false,
  sending = false,
  onSendVoiceNote,
  onMicDenied,
  onInvalidRecording,
}: Options) {
  const [recording, setRecording] = useState(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [starting, setStarting] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const recordedDurationRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  const active = recording || Boolean(previewBlob);

  useEffect(() => {
    return () => {
      stopTracks();
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!previewBlob) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(previewBlob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [previewBlob]);

  function stopTracks() {
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setActiveStream(null);
  }

  async function startRecording() {
    if (disabled || sending || starting || recording || previewBlob) return;

    setStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = createVoiceNoteRecorder(stream);
      chunksRef.current = [];
      streamRef.current = stream;
      setActiveStream(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        stopTracks();
        setRecording(false);
        onMicDenied?.();
      };

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "audio/ogg";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        recordedDurationRef.current = Date.now() - startedAtRef.current;
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
    recordedDurationRef.current = 0;
    stopTracks();
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function sendVoiceNote() {
    if (!previewBlob || sending) return false;
    if (
      recordedDurationRef.current < VOICE_NOTE_MIN_DURATION_MS ||
      !(await isValidOggBlob(previewBlob))
    ) {
      onInvalidRecording?.();
      return false;
    }
    await onSendVoiceNote(buildVoiceNoteFile(previewBlob));
    setPreviewBlob(null);
    setElapsedMs(0);
    recordedDurationRef.current = 0;
    return true;
  }

  return {
    active,
    recording,
    previewBlob,
    previewUrl,
    activeStream,
    elapsedMs,
    starting,
    startRecording,
    stopRecording,
    cancelRecording,
    sendVoiceNote,
  };
}
