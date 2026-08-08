"use client";

import { useEffect, useState } from "react";
import { PhoneCall } from "lucide-react";
import {
  useSaveTelephonySettings,
  useTelephonyNumbers,
  useTelephonySettings,
  useTelephonyVoices,
  type TelephonySettings,
} from "@/hooks/useTelephony";
import { useT } from "@/i18n/context";

const MODELS = ["gpt-realtime-2.1-mini", "gpt-realtime-2.1"];

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
  const { data, isLoading } = useTelephonySettings(botId);
  const { data: numbersData, isLoading: numbersLoading } = useTelephonyNumbers();
  const { data: voicesData } = useTelephonyVoices();
  const save = useSaveTelephonySettings(botId);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [model, setModel] = useState("gpt-realtime-2.1-mini");
  const [greeting, setGreeting] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [recordingEnabled, setRecordingEnabled] = useState(false);
  const [recordingNotice, setRecordingNotice] = useState("");

  useEffect(() => {
    if (!data) return;
    setPhoneNumber(data.telephonyPhoneNumber ?? "");
    setVoiceId(data.telephonyVoiceId ?? "");
    setModel(data.telephonyModel ?? "gpt-realtime-2.1-mini");
    setGreeting(data.telephonyGreeting ?? "");
    setSystemPrompt(data.telephonySystemPrompt ?? "");
    setRecordingEnabled(Boolean(data.telephonyRecordingEnabled));
    setRecordingNotice(data.telephonyRecordingNotice ?? "");
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
      if (!validatePhoneNumber()) return;
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
    if (!validatePhoneNumber()) return;
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
                  <span className="text-sm font-medium text-secondary">{t("telephony.voiceId")}</span>
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
                    {MODELS.map((item) => (
                      <option key={item} value={item}>
                        {item}
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
                <span className="text-sm font-medium text-secondary">{t("telephony.systemPrompt")}</span>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={5}
                  maxLength={8000}
                  className="w-full rounded-lg border border-default px-3 py-2 text-sm"
                />
              </label>

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
                disabled={save.isPending}
                className="rounded-lg bg-accent px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                {save.isPending ? t("bots.saving") : t("common.save")}
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
