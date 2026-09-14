import OpusMediaRecorder from "opus-media-recorder";

export const VOICE_NOTE_MAX_DURATION_MS = 10 * 60 * 1000;

const WORKER_BASE = "/opus-media-recorder";

export function createVoiceNoteRecorder(stream: MediaStream): MediaRecorder {
  const workerOptions = {
    encoderWorkerFactory: () => new Worker(`${WORKER_BASE}/encoderWorker.umd.js`),
    OggOpusEncoderWasmPath: `${WORKER_BASE}/OggOpusEncoder.wasm`,
    WebMOpusEncoderWasmPath: `${WORKER_BASE}/WebMOpusEncoder.wasm`,
  };

  return new OpusMediaRecorder(stream, { mimeType: "audio/ogg" }, workerOptions);
}

export function formatRecordingDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function buildVoiceNoteFile(blob: Blob): File {
  return new File([blob], `voice-note-${Date.now()}.ogg`, { type: "audio/ogg" });
}
