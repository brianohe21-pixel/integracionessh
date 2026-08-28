"use client";

import { ChevronRight, Mic, Sparkles, Volume2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { useT } from "@/i18n/context";
import type { TelnyxVoice } from "@/hooks/useTelephony";
import { getAssistantModelLabel, getAssistantModelOption } from "@/lib/assistant-models";
import { cn } from "@/lib/utils";
import { getTranscriptionModel } from "@/lib/transcription-models";
import {
  BACKGROUND_SOUND_NONE,
  getBackgroundSoundLabel,
} from "@/lib/background-sounds";
import type { VoiceAgentConfigSection } from "./VoiceAgentConfigDrawer";

type VoiceAgentModelCardsProps = {
  assistantModel: string;
  transcriptionModel: string;
  voiceId: string;
  voices: TelnyxVoice[];
  isFreeTier: boolean;
  backgroundSound: string;
  onOpenSection: (section: VoiceAgentConfigSection) => void;
};

export function VoiceAgentModelCards({
  assistantModel,
  transcriptionModel,
  voiceId,
  voices,
  isFreeTier,
  backgroundSound,
  onOpenSection,
}: VoiceAgentModelCardsProps) {
  const t = useT();

  const assistant = getAssistantModelOption(assistantModel);
  const transcription = getTranscriptionModel(transcriptionModel);
  const trimmedVoiceId = voiceId.trim();
  const matchedVoice = trimmedVoiceId
    ? voices.find((voice) => voice.id === trimmedVoiceId)
    : undefined;
  const voiceRequiresPaid =
    isFreeTier &&
    (Boolean(matchedVoice?.requiresPaidPlan) ||
      voices.some((voice) => voice.id === trimmedVoiceId && voice.requiresPaidPlan));

  const cards: Array<{
    section: VoiceAgentConfigSection;
    icon: typeof Volume2;
    title: string;
    label: string;
    subtitle: string;
    badge?: string;
    warning?: boolean;
  }> = [
    {
      section: "voice",
      icon: Volume2,
      title: t("voiceAgents.modelSection_voice"),
      label: matchedVoice?.name ?? (trimmedVoiceId || t("voiceAgents.modelNotConfigured")),
      subtitle: trimmedVoiceId
        ? backgroundSound !== BACKGROUND_SOUND_NONE
          ? t("voiceAgents.modelCardVoiceWithBackground", {
              background: getBackgroundSoundLabel(backgroundSound),
            })
          : t("voiceAgents.modelCardVoiceSubtitle")
        : t("voiceAgents.modelCardVoiceEmpty"),
      badge: matchedVoice?.category,
      warning: Boolean(voiceRequiresPaid),
    },
    {
      section: "transcription",
      icon: Mic,
      title: t("voiceAgents.modelSection_transcription"),
      label: transcription?.label ?? transcriptionModel,
      subtitle: transcription?.description ?? t("voiceAgents.modelCardTranscriptionSubtitle"),
    },
    {
      section: "assistant",
      icon: Sparkles,
      title: t("voiceAgents.modelSection_assistant"),
      label: assistant?.label ?? getAssistantModelLabel(assistantModel),
      subtitle: assistant?.description ?? t("voiceAgents.modelCardAssistantSubtitle"),
      badge: assistant?.tier
        ? t(`voiceAgents.modelTier_${assistant.tier}`)
        : assistant?.category
          ? t(`bots.modelCategory.${assistant.category}`)
          : undefined,
    },
  ];

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-primary">{t("voiceAgents.modelCardsTitle")}</h3>
        <p className="text-sm text-secondary">{t("voiceAgents.modelCardsSubtitle")}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.section}
              type="button"
              onClick={() => onOpenSection(card.section)}
              className={cn(
                "content-card content-card-interactive group flex flex-col gap-3 p-4 text-left",
                card.warning && "border-warning/30"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-muted text-accent">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-xs font-medium uppercase tracking-wide text-muted">
                    {card.title}
                  </span>
                </div>
                <ChevronRight
                  className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
                />
              </div>

              <div className="space-y-1">
                <p className="font-semibold text-primary leading-snug">{card.label}</p>
                <p className="text-sm text-secondary line-clamp-2">{card.subtitle}</p>
              </div>

              <div className="flex flex-wrap gap-1">
                {card.badge ? <Badge variant="default">{card.badge}</Badge> : null}
                {card.warning ? (
                  <Badge variant="warning">{t("voiceAgents.voicePaidBadge")}</Badge>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
