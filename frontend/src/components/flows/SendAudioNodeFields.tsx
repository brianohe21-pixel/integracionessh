"use client";

import { useRef, useState } from "react";
import { Loader2, Mic, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { VoiceNoteComposeBar } from "@/components/conversations/VoiceNoteComposeBar";
import { useFlowMediaUpload } from "@/hooks/useFlowMediaUpload";
import { useVoiceNoteRecorder } from "@/hooks/useVoiceNoteRecorder";
import { isValidOggBlob } from "@/lib/conversations/audio-recording";
import { useT } from "@/i18n/context";
import type { FlowNodeData } from "@/types";

type Props = {
  flowId: string;
  data: FlowNodeData;
  onUpdate: (patch: Record<string, unknown>) => void;
};

export function SendAudioNodeFields({ flowId, data, onUpdate }: Props) {
  const t = useT();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const upload = useFlowMediaUpload(flowId);

  async function persistUpload(file: File) {
    setError("");
    if (!file.name.toLowerCase().endsWith(".ogg") && !file.name.toLowerCase().endsWith(".opus")) {
      setError(t("flows.fields.audioFormatError"));
      return;
    }
    if (!(await isValidOggBlob(file))) {
      setError(t("flows.fields.audioFormatError"));
      return;
    }
    try {
      const result = await upload.mutateAsync({ file });
      onUpdate({
        audioS3Key: result.s3Key,
        audioFilename: result.filename,
        audioMimeType: result.mimeType,
        audioMediaId: result.mediaId,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("flows.fields.audioUploadError"));
    }
  }

  const voice = useVoiceNoteRecorder({
    sending: upload.isPending,
    onSendVoiceNote: persistUpload,
    onMicDenied: () => setError(t("conversations.voiceNoteMicDenied")),
    onInvalidRecording: () => setError(t("conversations.voiceNoteInvalid")),
  });

  return (
    <div className="space-y-3">
      <p className="text-xs text-secondary">{t("flows.fields.audioHint")}</p>

      {data.audioS3Key ? (
        <div className="rounded-lg border border-subtle bg-surface px-3 py-2.5">
          <p className="text-xs text-secondary">{t("flows.fields.audioUploaded")}</p>
          <p className="mt-1 truncate text-sm font-medium text-primary">
            {data.audioFilename || data.audioS3Key}
          </p>
        </div>
      ) : (
        <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2">
          {t("flows.fields.audioRequired")}
        </p>
      )}

      {voice.active ? (
        <div className="rounded-lg border border-subtle overflow-hidden">
          <VoiceNoteComposeBar voice={voice} sending={upload.isPending} />
          {voice.previewUrl ? (
            <div className="flex justify-end gap-2 border-t border-subtle px-3 py-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={upload.isPending}
                onClick={voice.cancelRecording}
              >
                {t("conversations.voiceNoteCancel")}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={upload.isPending}
                onClick={() => void voice.sendVoiceNote()}
              >
                {upload.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  t("flows.fields.audioUseRecording")
                )}
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={upload.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            {upload.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {data.audioS3Key ? t("flows.fields.audioReplace") : t("flows.fields.audioUpload")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={upload.isPending || voice.starting}
            onClick={() => void voice.startRecording()}
          >
            {voice.starting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
            {t("flows.fields.audioRecord")}
          </Button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".ogg,.opus,audio/ogg"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void persistUpload(file);
        }}
      />

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
