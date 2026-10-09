"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { useT } from "@/i18n/context";

export function AiAssistantOpenAIBlocker() {
  const t = useT();

  return (
    <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-secondary">
      <div className="flex gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <p>
          {t("aiAssistant.openaiNotConfigured")}{" "}
          <Link
            href="/settings?tab=apiKeys"
            className="font-medium text-accent hover:underline"
          >
            {t("aiAssistant.openaiNotConfiguredLink")}
          </Link>
        </p>
      </div>
    </div>
  );
}

export function mapAiAssistantEnableError(message: string, t: (key: string) => string): string {
  if (
    message.includes("OpenAI is not configured") ||
    message.includes("No OpenAI API key configured") ||
    message.includes("OPENAI_NOT_CONFIGURED")
  ) {
    return t("aiAssistant.openaiNotConfigured");
  }
  if (
    message.includes("PLAN_MODEL_NOT_ALLOWED") ||
    message.includes("Upgrade to Pro for advanced models") ||
    message.includes("is not available on the")
  ) {
    return t("bots.modelRequiresPro");
  }
  return message;
}
