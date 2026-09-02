"use client";

import Link from "next/link";
import { CheckCircle2, Circle, PhoneCall, Settings, Sparkles } from "lucide-react";
import { useProviderCredentials } from "@/hooks/useProviderCredentials";
import { useTelephonyNumbers, useTelephonySettings } from "@/hooks/useTelephony";
import { useT } from "@/i18n/context";

interface VoiceAgentSetupChecklistProps {
  botId: string;
  compact?: boolean;
}

function StepRow({
  done,
  title,
  description,
  action,
}: {
  done: boolean;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 rounded-lg border border-default p-3">
      {done ? (
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
      ) : (
        <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-primary">{title}</p>
        <p className="mt-0.5 text-xs text-secondary">{description}</p>
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
    </div>
  );
}

export function VoiceAgentSetupChecklist({ botId, compact = false }: VoiceAgentSetupChecklistProps) {
  const t = useT();
  const { data: credentials } = useProviderCredentials();
  const { data: numbersData } = useTelephonyNumbers();
  const { data: settings } = useTelephonySettings(botId);

  const telnyxConfigured = credentials?.items.some(
    (item) => item.provider === "telnyx" && item.configured
  );
  const openaiConfigured = credentials?.items.some(
    (item) => item.provider === "openai" && item.configured
  );
  const elevenConfigured = credentials?.items.some(
    (item) => item.provider === "elevenlabs" && item.configured
  );
  const hasNumber = (numbersData?.numbers.length ?? 0) > 0 || Boolean(settings?.telephonyPhoneNumber);
  const telephonyEnabled = Boolean(settings?.telephonyEnabled);
  const allDone = Boolean(telnyxConfigured && openaiConfigured && elevenConfigured && telephonyEnabled);

  if (allDone) return null;

  return (
    <div className={compact ? "mb-4 space-y-3 rounded-xl border border-default bg-surface p-4" : "content-card mb-4 space-y-4 p-6"}>
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-accent" />
        <div>
          <h2 className={compact ? "text-base font-semibold text-primary" : "text-lg font-semibold text-primary"}>
            {t("voiceAgents.setupTitle")}
          </h2>
          {!compact ? <p className="text-sm text-secondary">{t("voiceAgents.setupSubtitle")}</p> : null}
        </div>
      </div>

      <div className="space-y-2">
        <StepRow
          done={Boolean(telnyxConfigured)}
          title={t("voiceAgents.setupTelnyxTitle")}
          description={t("voiceAgents.setupTelnyxDesc")}
          action={
            telnyxConfigured ? null : (
              <Link
                href="/settings?tab=apiKeys"
                className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
              >
                <Settings className="h-3.5 w-3.5" />
                {t("voiceAgents.setupConnectTelnyx")}
              </Link>
            )
          }
        />
        <StepRow
          done={Boolean(openaiConfigured && elevenConfigured)}
          title={t("voiceAgents.setupAiTitle")}
          description={t("voiceAgents.setupAiDesc")}
          action={
            openaiConfigured && elevenConfigured ? null : (
              <Link
                href="/settings?tab=apiKeys"
                className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
              >
                <Settings className="h-3.5 w-3.5" />
                {t("voiceAgents.setupConnectAi")}
              </Link>
            )
          }
        />
        <StepRow
          done={telephonyEnabled && hasNumber}
          title={t("voiceAgents.setupAgentTitle")}
          description={t("voiceAgents.setupAgentDesc")}
          action={
            telephonyEnabled && hasNumber ? null : (
              <Link
                href={`/voice-agents?tab=phoneNumbers&botId=${botId}`}
                className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
              >
                <PhoneCall className="h-3.5 w-3.5" />
                {t("voiceAgents.setupConfigureAgent")}
              </Link>
            )
          }
        />
      </div>
    </div>
  );
}
