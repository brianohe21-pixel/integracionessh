"use client";

import { Check, Mic, Sparkles, Volume2, X } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useT } from "@/i18n/context";
import type { TelnyxVoice } from "@/hooks/useTelephony";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Tenant } from "@/types";
import {
  ASSISTANT_MODEL_GROUPS,
  formatAssistantModelSelectLabel,
  getVoiceAssistantModels,
  groupAssistantModelsByGroup,
  type AssistantModelGroup,
  type AssistantModelOption,
} from "@/lib/assistant-models";
import type { TenantPlan } from "@/types";
import { TRANSCRIPTION_MODELS } from "@/lib/transcription-models";
import {
  BACKGROUND_SOUND_NONE,
  BACKGROUND_SOUNDS,
} from "@/lib/background-sounds";
import { TTS_MODELS } from "@/lib/tts-models";
import { ElevenLabsConnectPanel } from "@/components/telephony/ElevenLabsConnectPanel";
import { SelectControl } from "@/components/ui/Input";
import { useProviderCredentials } from "@/hooks/useProviderCredentials";

export type VoiceAgentConfigSection = "assistant" | "transcription" | "voice";

type VoiceAgentConfigDrawerProps = {
  open: boolean;
  section: VoiceAgentConfigSection;
  assistantModel: string;
  transcriptionModel: string;
  voiceId: string;
  voices: TelnyxVoice[];
  isFreeTier: boolean;
  onClose: () => void;
  onSave?: () => void;
  isSaving?: boolean;
  onAssistantModelChange: (modelId: string) => void;
  onTranscriptionModelChange: (modelId: string) => void;
  onVoiceIdChange: (voiceId: string) => void;
  backgroundSound: string;
  backgroundSoundVolume: number;
  onBackgroundSoundChange: (soundId: string) => void;
  onBackgroundSoundVolumeChange: (volume: number) => void;
  ttsModel: string;
  voiceSpeed: number;
  voiceStability: number;
  voiceSimilarity: number;
  onTtsModelChange: (modelId: string) => void;
  onVoiceSpeedChange: (value: number) => void;
  onVoiceStabilityChange: (value: number) => void;
  onVoiceSimilarityChange: (value: number) => void;
  vadThreshold: number;
  silenceMs: number;
  bargeIn: boolean;
  onVadThresholdChange: (value: number) => void;
  onSilenceMsChange: (value: number) => void;
  onBargeInChange: (enabled: boolean) => void;
};

const SECTIONS: VoiceAgentConfigSection[] = ["voice", "transcription", "assistant"];

const SECTION_ICONS = {
  assistant: Sparkles,
  transcription: Mic,
  voice: Volume2,
} as const;

function assistantGroupLabel(
  group: AssistantModelGroup,
  t: ReturnType<typeof useT>
): string {
  if (group === "realtime") return t("voiceAgents.modelGroup_realtime");
  return t(`bots.modelCategory.${group}`);
}

function assistantModelBadgeLabel(
  model: AssistantModelOption,
  t: ReturnType<typeof useT>
): string | null {
  if (model.tier) return t(`voiceAgents.modelTier_${model.tier}`);
  if (model.category) return t(`bots.modelCategory.${model.category}`);
  return null;
}

function assistantModelBadgeVariant(
  model: AssistantModelOption
): "accent" | "info" | "warning" | "default" {
  if (model.tier === "flagship" || model.category === "flagship") return "info";
  if (model.tier === "balanced" || model.category === "reasoning") return "warning";
  if (model.tier === "economy" || model.category === "economy") return "accent";
  return "default";
}

function planLabel(plan: TenantPlan, t: ReturnType<typeof useT>): string {
  if (plan === "free") return t("common.planFree");
  if (plan === "starter") return t("common.planStarter");
  if (plan === "pro") return t("common.planPro");
  if (plan === "scale") return t("common.planScale");
  return t("common.planReseller");
}

function assistantModelDescription(
  model: AssistantModelOption,
  t: ReturnType<typeof useT>
): string {
  if (model.description) return model.description;
  if (model.kind === "chat" && model.category) {
    return t(`voiceAgents.chatModelDesc_${model.category}`);
  }
  if (model.tier) {
    return t(`voiceAgents.realtimeModelBestFor_${model.tier}`);
  }
  return "";
}

function AssistantModelMetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-default/60 py-2 last:border-b-0 last:pb-0 first:pt-0">
      <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
      <span className="text-right text-sm font-medium text-primary">{value}</span>
    </div>
  );
}

function AssistantModelDetails({
  model,
  t,
}: {
  model: AssistantModelOption;
  t: ReturnType<typeof useT>;
}) {
  const description = assistantModelDescription(model, t);
  const badge = assistantModelBadgeLabel(model, t);

  return (
    <div className="space-y-4 rounded-xl border border-default bg-gradient-to-br from-surface-muted/50 to-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-base font-semibold text-primary">{model.label}</span>
        {badge ? (
          <Badge variant={assistantModelBadgeVariant(model)}>{badge}</Badge>
        ) : null}
        <Badge variant={model.kind === "realtime" ? "accent" : "info"}>
          {model.kind === "realtime"
            ? t("voiceAgents.assistantModelKindRealtime")
            : t("voiceAgents.assistantModelKindChat")}
        </Badge>
      </div>

      {description ? (
        <p className="text-sm leading-relaxed text-secondary">{description}</p>
      ) : null}

      <div className="rounded-xl border border-default/80 bg-surface-elevated/90 p-3">
        <AssistantModelMetaRow
          label={t("voiceAgents.assistantModelApiLabel")}
          value={
            model.kind === "realtime"
              ? t("voiceAgents.assistantModelKindRealtime")
              : t("voiceAgents.assistantModelKindChat")
          }
        />
        <AssistantModelMetaRow
          label={t("voiceAgents.assistantModelGroupLabel")}
          value={assistantGroupLabel(model.group, t)}
        />
        <AssistantModelMetaRow
          label={t("voiceAgents.assistantModelProvider")}
          value="OpenAI"
        />
        {model.minPlan ? (
          <AssistantModelMetaRow
            label={t("voiceAgents.assistantModelMinPlan")}
            value={planLabel(model.minPlan, t)}
          />
        ) : null}
      </div>

      <div className="space-y-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">
          {t("voiceAgents.assistantModelIdLabel")}
        </span>
        <p className="rounded-lg border border-default bg-surface px-3 py-2.5 font-mono text-xs text-secondary break-all">
          {model.id}
        </p>
      </div>
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-1 pb-3">
      <h3 className="font-semibold text-primary">{title}</h3>
      <p className="text-sm text-secondary">{description}</p>
    </div>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  formatValue,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  formatValue: (value: number) => string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-primary">{label}</span>
        <span className="text-secondary">{formatValue(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-accent"
      />
    </label>
  );
}

function SettingsSwitch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-primary">{label}</p>
        {description ? <p className="text-xs text-secondary">{description}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors",
          checked ? "bg-accent" : "bg-gray-200"
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface-elevated shadow transition",
            checked ? "translate-x-5" : "translate-x-0"
          )}
        />
      </button>
    </label>
  );
}

function SelectionIndicator({ selected }: { selected: boolean }) {
  return (
    <span
      className={cn(
        "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
        selected ? "border-accent bg-accent text-white" : "border-default bg-surface"
      )}
    >
      {selected ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : null}
    </span>
  );
}

function OptionList({ children }: { children: ReactNode }) {
  return (
    <ul className="overflow-hidden rounded-lg border border-default bg-surface">
      {children}
    </ul>
  );
}

function OptionRow({
  selected,
  onSelect,
  title,
  description,
  metaId,
  badges,
  dimmed,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description?: string;
  metaId?: string;
  badges?: ReactNode;
  dimmed?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "flex w-full gap-3 px-4 py-3 text-left transition-colors",
          "border-b border-default last:border-b-0",
          selected ? "bg-accent-muted/50" : "hover:bg-surface-muted/60",
          dimmed && "opacity-60"
        )}
      >
        <SelectionIndicator selected={selected} />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium text-primary">{title}</span>
            {badges}
          </div>
          {description ? <p className="text-sm text-secondary">{description}</p> : null}
          {metaId ? <p className="font-mono text-xs text-muted">{metaId}</p> : null}
        </div>
      </button>
    </li>
  );
}

export function VoiceAgentConfigDrawer({
  open,
  section,
  assistantModel,
  transcriptionModel,
  voiceId,
  voices,
  isFreeTier,
  onClose,
  onSave,
  isSaving = false,
  onAssistantModelChange,
  onTranscriptionModelChange,
  onVoiceIdChange,
  backgroundSound,
  backgroundSoundVolume,
  onBackgroundSoundChange,
  onBackgroundSoundVolumeChange,
  ttsModel,
  voiceSpeed,
  voiceStability,
  voiceSimilarity,
  onTtsModelChange,
  onVoiceSpeedChange,
  onVoiceStabilityChange,
  onVoiceSimilarityChange,
  vadThreshold,
  silenceMs,
  bargeIn,
  onVadThresholdChange,
  onSilenceMsChange,
  onBargeInChange,
}: VoiceAgentConfigDrawerProps) {
  const t = useT();
  const { data: tenant } = useQuery({
    queryKey: ["tenants", "me"],
    queryFn: () => api.get<Tenant>("/tenants/me"),
  });
  const assistantModels = useMemo(
    () => getVoiceAssistantModels(tenant?.plan, assistantModel),
    [tenant?.plan, assistantModel]
  );
  const assistantModelsByGroup = useMemo(
    () => groupAssistantModelsByGroup(assistantModels),
    [assistantModels]
  );
  const selectedAssistantModel = useMemo(
    () => assistantModels.find((model) => model.id === assistantModel),
    [assistantModels, assistantModel]
  );
  const { data: credentials } = useProviderCredentials();
  const elevenLabsConfigured = credentials?.items.some(
    (item) => item.provider === "elevenlabs" && item.configured
  );
  const [activeSection, setActiveSection] = useState<VoiceAgentConfigSection>(section);

  const trimmedVoiceId = voiceId.trim();
  const matchedVoice = trimmedVoiceId
    ? voices.find((voice) => voice.id === trimmedVoiceId)
    : undefined;
  const selectedVoiceRequiresPaidPlan =
    isFreeTier && Boolean(matchedVoice?.requiresPaidPlan);

  useEffect(() => {
    if (!open) return;
    setActiveSection(section);
  }, [open, section]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-50 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-3xl flex-col border-l border-default bg-surface-elevated shadow-xl"
        aria-label={t("voiceAgents.modelDrawerTitle")}
      >
        <div className="flex items-center justify-between border-b border-default px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-primary">
              {t("voiceAgents.modelDrawerTitle")}
            </h2>
            <p className="text-sm text-secondary">{t("voiceAgents.modelDrawerSubtitle")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted hover:bg-surface-muted hover:text-secondary"
            aria-label={t("common.close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <nav
            className="flex gap-1 border-b border-default p-3 md:w-52 md:flex-col md:border-b-0 md:border-r md:p-4"
            aria-label={t("voiceAgents.modelDrawerNav")}
          >
            {SECTIONS.map((item) => {
              const Icon = SECTION_ICONS[item];
              const isActive = activeSection === item;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setActiveSection(item)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors md:w-full",
                    isActive
                      ? "bg-accent-muted text-accent ring-1 ring-accent/20"
                      : "text-secondary hover:bg-surface-muted hover:text-primary"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{t(`voiceAgents.modelSection_${item}`)}</span>
                </button>
              );
            })}
          </nav>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-5">
            {activeSection === "assistant" ? (
              <div className="space-y-4">
                <SectionHeader
                  title={t("voiceAgents.modelSection_assistant")}
                  description={t("voiceAgents.modelSection_assistantDesc")}
                />

                <div className="overflow-hidden rounded-xl border border-default bg-surface">
                  <div className="flex items-center gap-2 border-b border-default bg-surface-muted/40 px-4 py-3">
                    <Sparkles className="h-4 w-4 text-accent" />
                    <span className="text-sm font-medium text-primary">
                      {t("voiceAgents.modelSection_assistant")}
                    </span>
                  </div>

                  <div className="space-y-4 p-4">
                    <label className="block space-y-2">
                      <div className="space-y-1">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted">
                          {t("bots.model")}
                        </span>
                        <p className="text-xs text-secondary">
                          {t("voiceAgents.assistantModelSelectHint")}
                        </p>
                      </div>
                      <SelectControl
                        value={assistantModel}
                        onChange={(event) => onAssistantModelChange(event.target.value)}
                        selectClassName="h-11 bg-surface font-medium"
                      >
                        {ASSISTANT_MODEL_GROUPS.map((group) => {
                          const models = assistantModelsByGroup[group];
                          if (!models?.length) return null;

                          return (
                            <optgroup
                              key={group}
                              label={`${assistantGroupLabel(group, t)} (${models.length})`}
                            >
                              {models.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {formatAssistantModelSelectLabel(item, (key) => t(key))}
                                </option>
                              ))}
                            </optgroup>
                          );
                        })}
                      </SelectControl>
                    </label>

                    {selectedAssistantModel ? (
                      <AssistantModelDetails model={selectedAssistantModel} t={t} />
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            {activeSection === "transcription" ? (
              <div className="space-y-6">
                <SectionHeader
                  title={t("voiceAgents.modelSection_transcription")}
                  description={t("voiceAgents.modelSection_transcriptionDesc")}
                />
                <OptionList>
                  {TRANSCRIPTION_MODELS.map((item) => (
                    <OptionRow
                      key={item.id}
                      selected={transcriptionModel === item.id}
                      onSelect={() => onTranscriptionModelChange(item.id)}
                      title={item.label}
                      description={item.description}
                      metaId={item.id}
                      badges={<Badge variant="default">{item.providerLabel}</Badge>}
                    />
                  ))}
                </OptionList>

                <div className="space-y-4 border-t border-default pt-4">
                  <h4 className="text-sm font-semibold text-primary">
                    {t("voiceAgents.transcriptionVadTitle")}
                  </h4>
                  <SliderField
                    label={t("voiceAgents.transcriptionVadThreshold")}
                    value={vadThreshold}
                    min={0.3}
                    max={0.9}
                    step={0.05}
                    formatValue={(value) => value.toFixed(2)}
                    onChange={onVadThresholdChange}
                  />
                  <SliderField
                    label={t("voiceAgents.transcriptionSilenceMs")}
                    value={silenceMs}
                    min={300}
                    max={1200}
                    step={50}
                    formatValue={(value) => `${Math.round(value)} ms`}
                    onChange={onSilenceMsChange}
                  />
                  <SettingsSwitch
                    checked={bargeIn}
                    onChange={onBargeInChange}
                    label={t("voiceAgents.transcriptionBargeIn")}
                    description={t("voiceAgents.transcriptionBargeInDesc")}
                  />
                </div>
              </div>
            ) : null}

            {activeSection === "voice" ? (
              <div className="space-y-6">
                <SectionHeader
                  title={t("voiceAgents.modelSection_voice")}
                  description={t("voiceAgents.modelSection_voiceDesc")}
                />

                <ElevenLabsConnectPanel />

                {elevenLabsConfigured ? (
                  <>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-primary">
                    {t("telephony.voiceId")}
                  </span>
                  <input
                    value={voiceId}
                    onChange={(e) => onVoiceIdChange(e.target.value)}
                    placeholder={t("voiceAgents.voiceIdPlaceholder")}
                    className="w-full rounded-lg border border-default px-3 py-2 text-sm font-mono"
                  />
                  <p className="text-xs text-secondary">{t("voiceAgents.voiceIdHint")}</p>
                  {matchedVoice ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="accent">{matchedVoice.name}</Badge>
                      {matchedVoice.category ? (
                        <Badge variant="default">{matchedVoice.category}</Badge>
                      ) : null}
                    </div>
                  ) : null}
                  {selectedVoiceRequiresPaidPlan ? (
                    <p className="text-xs text-warning">{t("voiceAgents.voicePaidPlanWarning")}</p>
                  ) : null}
                </label>

                <div className="space-y-4 border-t border-default pt-4">
                  <h4 className="text-sm font-semibold text-primary">
                    {t("voiceAgents.voiceTuningTitle")}
                  </h4>
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-primary">
                      {t("voiceAgents.ttsModel")}
                    </span>
                    <select
                      value={ttsModel}
                      onChange={(e) => onTtsModelChange(e.target.value)}
                      className="w-full rounded-lg border border-default px-3 py-2 text-sm"
                    >
                      {TTS_MODELS.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-secondary">
                      {TTS_MODELS.find((item) => item.id === ttsModel)?.description}
                    </p>
                  </label>
                  <SliderField
                    label={t("voiceAgents.voiceSpeed")}
                    value={voiceSpeed}
                    min={0.7}
                    max={1.2}
                    step={0.05}
                    formatValue={(value) => `${value.toFixed(2)}x`}
                    onChange={onVoiceSpeedChange}
                  />
                  <SliderField
                    label={t("voiceAgents.voiceStability")}
                    value={voiceStability}
                    min={0}
                    max={1}
                    step={0.05}
                    formatValue={(value) => `${Math.round(value * 100)}%`}
                    onChange={onVoiceStabilityChange}
                  />
                  <SliderField
                    label={t("voiceAgents.voiceSimilarity")}
                    value={voiceSimilarity}
                    min={0}
                    max={1}
                    step={0.05}
                    formatValue={(value) => `${Math.round(value * 100)}%`}
                    onChange={onVoiceSimilarityChange}
                  />
                </div>

                <div className="space-y-3 border-t border-default pt-4">
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-primary">
                      {t("voiceAgents.backgroundSoundTitle")}
                    </span>
                    <p className="text-xs text-secondary">{t("voiceAgents.backgroundSoundDesc")}</p>
                    <select
                      value={backgroundSound}
                      onChange={(e) => onBackgroundSoundChange(e.target.value)}
                      className="w-full rounded-lg border border-default px-3 py-2 text-sm"
                    >
                      <option value={BACKGROUND_SOUND_NONE}>
                        {t("voiceAgents.backgroundSoundNone")}
                      </option>
                      {BACKGROUND_SOUNDS.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                    {backgroundSound !== BACKGROUND_SOUND_NONE ? (
                      <p className="text-xs text-secondary">
                        {BACKGROUND_SOUNDS.find((item) => item.id === backgroundSound)?.description}
                      </p>
                    ) : (
                      <p className="text-xs text-secondary">
                        {t("voiceAgents.backgroundSoundNoneDesc")}
                      </p>
                    )}
                  </label>

                  {backgroundSound !== BACKGROUND_SOUND_NONE ? (
                    <label className="block space-y-2 pt-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-primary">
                          {t("voiceAgents.backgroundSoundVolume")}
                        </span>
                        <span className="text-secondary">
                          {Math.round(backgroundSoundVolume * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.01}
                        max={1}
                        step={0.01}
                        value={backgroundSoundVolume}
                        onChange={(e) =>
                          onBackgroundSoundVolumeChange(parseFloat(e.target.value))
                        }
                        className="w-full accent-accent"
                      />
                    </label>
                  ) : null}
                </div>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-default px-5 py-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
            {t("common.close")}
          </Button>
          {onSave ? (
            <Button type="button" onClick={onSave} disabled={isSaving}>
              {isSaving ? t("bots.saving") : t("common.save")}
            </Button>
          ) : null}
        </div>
      </aside>
    </>,
    document.body
  );
}
