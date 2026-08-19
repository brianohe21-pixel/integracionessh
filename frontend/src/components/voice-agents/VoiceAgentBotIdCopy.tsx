"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useT } from "@/i18n/context";

interface VoiceAgentBotIdCopyProps {
  botId: string;
  compact?: boolean;
}

export function VoiceAgentBotIdCopy({ botId, compact = false }: VoiceAgentBotIdCopyProps) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(botId);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => void copy()}
        title={t("voiceAgents.botIdCopy")}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-secondary hover:bg-surface-muted hover:text-primary"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
        <span className="font-mono">{botId.slice(0, 8)}…</span>
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-default bg-surface-muted/40 px-3 py-2 text-sm">
      <span className="text-secondary">{t("voiceAgents.botIdLabel")}</span>
      <code className="min-w-0 break-all font-mono text-xs text-primary">{botId}</code>
      <button
        type="button"
        onClick={() => void copy()}
        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-default bg-surface-elevated px-2 py-1 text-xs text-secondary hover:bg-surface-muted hover:text-primary"
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5 text-green-600" />
            {t("voiceAgents.botIdCopied")}
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" />
            {t("voiceAgents.botIdCopy")}
          </>
        )}
      </button>
    </div>
  );
}
