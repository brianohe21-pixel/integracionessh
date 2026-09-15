"use client";

import { Loader2, Mic } from "lucide-react";
import { useT } from "@/i18n/context";

type Props = {
  disabled?: boolean;
  sending?: boolean;
  starting?: boolean;
  onStart: () => void;
};

export function ConversationVoiceRecorder({
  disabled = false,
  sending = false,
  starting = false,
  onStart,
}: Props) {
  const t = useT();

  return (
    <button
      type="button"
      onClick={onStart}
      disabled={disabled || sending || starting}
      aria-label={t("conversations.voiceNoteRecord")}
      className="conversations-compose-action"
    >
      {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
    </button>
  );
}
