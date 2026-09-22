"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { useT } from "@/i18n/context";
import {
  getAiAssistantDisableBlockers,
  type AiAssistantDisableBlocker,
} from "@/lib/ai-assistant-policy";
import type { Bot } from "@/types";

const TAB_BY_BLOCKER: Record<AiAssistantDisableBlocker, string> = {
  telephony: "telephony",
  voicebot: "voicebot",
};

const MESSAGE_KEY: Record<AiAssistantDisableBlocker, string> = {
  telephony: "aiAssistant.disableBlockedTelephony",
  voicebot: "aiAssistant.disableBlockedVoicebot",
};

const TAB_LABEL_KEY: Record<AiAssistantDisableBlocker, string> = {
  telephony: "bots.tabTelephony",
  voicebot: "bots.tabVoicebot",
};

type AiAssistantDisableBlockersProps = {
  bot: Pick<Bot, "botId" | "telephonyEnabled" | "voicebotEnabled">;
};

export function AiAssistantDisableBlockers({ bot }: AiAssistantDisableBlockersProps) {
  const t = useT();
  const blockers = getAiAssistantDisableBlockers(bot);
  if (!blockers.length) return null;

  return (
    <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-secondary">
      <div className="flex gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <div className="space-y-2">
          {blockers.map((blocker) => (
            <p key={blocker}>
              {t(MESSAGE_KEY[blocker])}{" "}
              <Link
                href={`/bots/${bot.botId}/edit?tab=${TAB_BY_BLOCKER[blocker]}`}
                className="font-medium text-accent hover:underline"
              >
                {t(TAB_LABEL_KEY[blocker])}
              </Link>
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
