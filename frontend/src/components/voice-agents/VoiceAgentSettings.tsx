"use client";

import { useEffect, useState } from "react";
import { Eye, PhoneCall, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { BotKnowledge } from "@/components/bots/BotKnowledge";
import {
  useSaveTelephonySettings,
  useTelephonyNumbers,
  useTelephonySettings,
  useTelephonyVoices,
  type TelephonySettings,
} from "@/hooks/useTelephony";
import { useBot } from "@/hooks/useBots";
import { useVoiceAgentTools } from "@/hooks/useVoiceAgentTools";
import { useT } from "@/i18n/context";
import { buildVoiceAgentToolPromptSnippet } from "@/lib/voice-agent-tool-secret-refs";
import {
  DEFAULT_REALTIME_MODEL_ID,
  REALTIME_MODELS,
} from "@/lib/realtime-models";
import { TELEPHONY_SYSTEM_PROMPT_MAX_LENGTH } from "@/lib/voice-agent-limits";

function SettingsSwitch({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors ${
        checked ? "bg-accent" : "bg-gray-200"
      } ${disabled ? "opacity-50" : ""}`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface-elevated shadow transition ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

interface VoiceAgentSettingsProps {
  botId: string;
}

export function VoiceAgentSettings({ botId }: VoiceAgentSettingsProps) {
  const t = useT();
  const { data: bot } = useBot(botId);
  const { data: toolsData } = useVoiceAgentTools(botId);
  const { data, isLoading } = useTelephonySettings(botId);
  const { data: numbersData, isLoading: numbersLoading } = useTelephonyNumbers();
  const { data: voicesData } = useTelephonyVoices();
  const save = useSaveTelephonySettings(botId);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [model, setModel] = useState(DEFAULT_REALTIME_MODEL_ID);
  const [greeting, setGreeting] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [recordingEnabled, setRecordingEnabled] = useState(false);
  const [recordingNotice, setRecordingNotice] = useState("");
  const [handoffEnabled, setHandoffEnabled] = useState(false);
  const enabledTools = (toolsData?.tools ?? []).filter((tool) => tool.enabled);

  function insertToolIntoPrompt(toolId: string) {
    const tool = enabledTools.find((item) => item.toolId === toolId);
    if (!tool) return;
    const snippet = buildVoiceAgentToolPromptSnippet(tool);
    setSystemPrompt((current) => {
      const trimmed = current.trim();
      return trimmed ? `${trimmed}\n\n${snippet}` : snippet;
    });
  }

  const [showPromptModal, setShowPromptModal] = useState(false);

  useEffect(() => {
    if (!data) return;
    setPhoneNumber(data.telephonyPhoneNumber ?? "");
    setVoiceId(data.telephonyVoiceId ?? "");
    setModel(data.telephonyModel ?? DEFAULT_REALTIME_MODEL_ID);
    setGreeting(data.telephonyGreeting ?? "");
    setSystemPrompt(data.telephonySystemPrompt ?? "");
    setRecordingEnabled(Boolean(data.telephonyRecordingEnabled));
    setRecordingNotice(data.telephonyRecordingNotice ?? "");
    setHandoffEnabled(Boolean(data.telephonyHandoffEnabled));
  }, [data]);

  const numbers = numbersData?.numbers ?? [];
  const voices = voicesData?.voices ?? [];
  const isFreeTier = voicesData?.tier === "free";
  const selectableVoices = isFreeTier
    ? voices.filter((voice) => !voice.requiresPaidPlan)
    : voices;
  const selectedVoiceRequiresPaidPlan =
    isFreeTier &&
    voices.some((voice) => voice.id === voiceId.trim() && voice.requiresPaidPlan);
  const selectedVoice = voiceId.trim()
    ? voices.find((voice) => voice.id === voiceId.trim())
    : undefined;
  const systemPromptTooLong = systemPrompt.length > TELEPHONY_SYSTEM_PROMPT_MAX_LENGTH;

  function validateSystemPrompt(): boolean {
    if (!systemPromptTooLong) return true;
    setSuccess("");
    setError(
      t("bots.validationSystemPromptTooLong", { max: TELEPHONY_SYSTEM_PROMPT_MAX_LENGTH })
    );
    return false;
  }
  const enabled = Boolean(data?.telephonyEnabled);
  const hasPhoneNumber = phoneNumber.trim().length > 0;

  useEffect(() => {
    if (numbers.length > 0 && !phoneNumber.trim()) {
      setPhoneNumber(numbers[0]!.phoneNumber);
    }
  }, [numbers, phoneNumber]);

  function buildPayload(includeEnabled?: boolean): TelephonySettings & { enabled?: boolean } {
    const payload: TelephonySettings & { enabled?: boolean } = {
      telephonyPhoneNumber: phoneNumber.trim(),
      telephonyModel: model,
      telephonyRecordingEnabled: recordingEnabled,
      telephonyRecordingNotice: recordingNotice.trim(),
      telephonyHandoffEnabled: handoffEnabled,
    };
    if (includeEnabled !== undefined) payload.enabled = includeEnabled;
    if (voiceId.trim()) payload.telephonyVoiceId = voiceId.trim();
    if (greeting.trim()) payload.telephonyGreeting = greeting.trim();
    if (systemPrompt.trim()) payload.telephonySystemPrompt = systemPrompt.trim();
    return payload;
  }

  function validatePhoneNumber(): boolean {
    if (phoneNumber.trim()) return true;
    setSuccess("");
    setError(t("telephony.phoneNumberRequired"));
    return false;
  }

  function handleEnabledChange(next: boolean) {
    if (next) {
      if (!validatePhoneNumber() || !validateSystemPrompt()) return;
      setError("");
      save.mutate(buildPayload(true), {
        onSuccess: () => {
          setSuccess(t("telephony.saved"));
          setTimeout(() => setSuccess(""), 3000);
        },
        onError: (err) => setError(err.message),
      });
      return;
    }
    setError("");
    save.mutate(
      { enabled: false },
      {
        onSuccess: () => {
          setSuccess(t("telephony.saved"));
          setTimeout(() => setSuccess(""), 3000);
        },
        onError: (err) => setError(err.message),
      }
    );
  }

  function handleSave() {
    if (!validatePhoneNumber() || !validateSystemPrompt()) return;
    setError("");
    save.mutate(buildPayload(), {
      onSuccess: () => {
        setSuccess(t("telephony.saved"));
        setTimeout(() => setSuccess(""), 3000);
      },
      onError: (err) => setError(err.message),
    });
  }

  return (
    <div className="space-y-6">
      <div className="content-card space-y-4 p-6">
      <div className="flex items-center gap-2">
        <PhoneCall className="h-5 w-5 text-accent" />
        <div>
          <h2 className="text-lg font-semibold text-primary">{t("voiceAgents.configTitle")}</h2>
          <p className="text-sm text-secondary">{t("voiceAgents.configSubtitle")}</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3">
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}

      {isLoading ? (
        <div className="h-24 animate-pulse rounded bg-surface-muted" />
      ) : (
        <>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-secondary">{t("telephony.phoneNumber")}</span>
            {numbersLoading ? (
              <div className="h-10 animate-pulse rounded-lg bg-surface-muted" />
            ) : numbers.length > 0 ? (
              <select
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full rounded-lg border border-default px-3 py-2 text-sm"
              >
                {numbers.map((item) => (
                  <option key={item.id} value={item.phoneNumber}>
                    {item.phoneNumber}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+17871234567"
                className="w-full rounded-lg border border-default px-3 py-2 text-sm"
              />
            )}
          </label>

          <label className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-primary">{t("telephony.enableLabel")}</p>
              <p className="text-sm text-secondary">
                {hasPhoneNumber ? t("telephony.enableHint") : t("telephony.configureNumberFirst")}
              </p>
            </div>
            <SettingsSwitch
              checked={enabled}
              disabled={save.isPending || !hasPhoneNumber}
              onChange={handleEnabledChange}
            />
          </label>

          {enabled && (
            <>
              <div className="grid grid-cols-1 gap-4 border-t border-subtle pt-4 md:grid-cols-2">
                <label className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-secondary">{t("telephony.voiceId")}</span>
                    {selectedVoice && <Badge variant="accent">{selectedVoice.name}</Badge>}
                  </div>
                  <input
                    value={voiceId}
                    onChange={(e) => setVoiceId(e.target.value)}
                    placeholder={t("voiceAgents.voiceIdPlaceholder")}
                    list={
                      selectableVoices.length > 0 ? `elevenlabs-voices-${botId}` : undefined
                    }
                    className="w-full rounded-lg border border-default px-3 py-2 text-sm"
                  />
                  {selectableVoices.length > 0 && (
                    <datalist id={`elevenlabs-voices-${botId}`}>
                      {selectableVoices.map((voice) => (
                        <option key={voice.id} value={voice.id}>
                          {voice.name}
                        </option>
                      ))}
                    </datalist>
                  )}
                  {selectedVoiceRequiresPaidPlan ? (
                    <p className="text-xs text-warning">
                      {t("voiceAgents.voicePaidPlanWarning")}
                    </p>
                  ) : (
                    <p className="text-xs text-secondary">{t("voiceAgents.voiceIdHint")}</p>
                  )}
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-secondary">{t("telephony.model")}</span>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full rounded-lg border border-default px-3 py-2 text-sm"
                  >
                    {REALTIME_MODELS.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block space-y-1">
                <span className="text-sm font-medium text-secondary">{t("telephony.greeting")}</span>
                <input
                  value={greeting}
                  onChange={(e) => setGreeting(e.target.value)}
                  className="w-full rounded-lg border border-default px-3 py-2 text-sm"
                />
              </label>

              <label className="block space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-sm font-medium text-secondary">
                    {t("telephony.systemPrompt")}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    {enabledTools.length > 0 ? (
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          const value = e.target.value;
                          if (!value) return;
                          insertToolIntoPrompt(value);
                          e.currentTarget.value = "";
                        }}
                        className="rounded-lg border border-default px-2 py-1.5 text-sm"
                      >
                        <option value="">{t("voiceAgents.toolsInsertPrompt")}</option>
                        {enabledTools.map((tool) => (
                          <option key={tool.toolId} value={tool.toolId}>
                            {tool.name}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPromptModal(true)}
                    >
                      <Eye className="h-4 w-4" />
                      {t("voiceAgents.viewPrompt")}
                    </Button>
                  </div>
                </div>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={8}
                  maxLength={TELEPHONY_SYSTEM_PROMPT_MAX_LENGTH}
                  className="w-full rounded-lg border border-default px-3 py-2 text-sm"
                />
                <p className="text-xs text-muted">
                  {t("bots.systemPromptCharCount", {
                    current: systemPrompt.length,
                    max: TELEPHONY_SYSTEM_PROMPT_MAX_LENGTH,
                  })}
                </p>
              </label>

              <div className="space-y-3 rounded-xl border border-default bg-surface p-4">
                <label className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-primary">{t("voiceAgents.handoffEnabled")}</p>
                    <p className="text-sm text-secondary">{t("voiceAgents.handoffHint")}</p>
                  </div>
                  <SettingsSwitch checked={handoffEnabled} onChange={setHandoffEnabled} />
                </label>
              </div>

              <div className="space-y-3 rounded-xl border border-default bg-surface p-4">
                <label className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-primary">{t("voiceAgents.recordingEnabled")}</p>
                    <p className="text-sm text-secondary">{t("voiceAgents.recordingHint")}</p>
                  </div>
                  <SettingsSwitch checked={recordingEnabled} onChange={setRecordingEnabled} />
                </label>
                {recordingEnabled && (
                  <label className="block space-y-1">
                    <span className="text-sm font-medium text-secondary">
                      {t("voiceAgents.recordingNotice")}
                    </span>
                    <input
                      value={recordingNotice}
                      onChange={(e) => setRecordingNotice(e.target.value)}
                      placeholder={t("voiceAgents.recordingNoticePlaceholder")}
                      className="w-full rounded-lg border border-default px-3 py-2 text-sm"
                    />
                  </label>
                )}
              </div>

              <button
                type="button"
                onClick={handleSave}
                disabled={save.isPending || systemPromptTooLong}
                className="rounded-lg bg-accent px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                {save.isPending ? t("bots.saving") : t("common.save")}
              </button>
            </>
          )}
        </>
      )}
      </div>

      {bot ? (
        <BotKnowledge
          bot={bot}
          showToggle={false}
          title={t("voiceAgents.knowledgeTitle")}
          subtitle={t("voiceAgents.knowledgeSubtitle")}
          onKnowledgeEnabledChange={(next) => {
            if (!next) return;
            save.mutate({ knowledgeEnabled: true });
          }}
        />
      ) : null}

      {showPromptModal ? (
        <Modal className="p-4">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-default bg-surface-elevated shadow-xl">
            <div className="flex items-center justify-between border-b border-default px-6 py-4">
              <h2 className="text-lg font-semibold text-primary">{t("telephony.systemPrompt")}</h2>
              <button
                type="button"
                onClick={() => setShowPromptModal(false)}
                className="rounded-md p-1 text-muted hover:bg-surface-muted hover:text-secondary"
                aria-label={t("common.close")}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto px-6 py-5">
              <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-primary">
                {systemPrompt.trim() || t("voiceAgents.viewPromptEmpty")}
              </pre>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-default px-6 py-4">
              <p className="text-xs text-muted">
                {t("bots.systemPromptCharCount", {
                  current: systemPrompt.length,
                  max: TELEPHONY_SYSTEM_PROMPT_MAX_LENGTH,
                })}
              </p>
              <Button type="button" variant="ghost" onClick={() => setShowPromptModal(false)}>
                {t("common.close")}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
