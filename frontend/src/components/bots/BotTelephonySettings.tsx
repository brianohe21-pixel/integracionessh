"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PhoneCall } from "lucide-react";
import { TelnyxConnectPanel } from "@/components/telephony/TelnyxConnectPanel";
import { useDialog } from "@/components/ui/DialogProvider";
import { api } from "@/lib/api";
import { useProviderCredentials } from "@/hooks/useProviderCredentials";
import { useT } from "@/i18n/context";
import { formatTelephonyError } from "@/lib/telnyx-errors";
import { getTelephonyNumberAssignment } from "@/lib/telephony-number-assignment";
import {
  DEFAULT_REALTIME_MODEL_ID,
  REALTIME_MODELS,
} from "@/lib/realtime-models";
import { TELEPHONY_SYSTEM_PROMPT_MAX_LENGTH } from "@/lib/voice-agent-limits";

interface TelephonySettingsResponse {
  telephonyEnabled?: boolean;
  telephonyPhoneNumber?: string;
  telephonyVoiceId?: string;
  telephonyModel?: string;
  telephonyGreeting?: string;
  telephonySystemPrompt?: string;
}

interface TelnyxNumber {
  id: string;
  phoneNumber: string;
  status: string;
  assignedBotId?: string;
  assignedBotName?: string;
}

type SaveTelephonyPayload = TelephonySettingsResponse & {
  enabled?: boolean;
  reassignPhoneNumber?: boolean;
};

interface BotTelephonySettingsProps {
  botId: string;
}

const MODELS = REALTIME_MODELS;

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

export function BotTelephonySettings({ botId }: BotTelephonySettingsProps) {
  const t = useT();
  const dialog = useDialog();
  const qc = useQueryClient();
  const { data: credentials } = useProviderCredentials();
  const telnyxStatus = credentials?.items.find((item) => item.provider === "telnyx");
  const telnyxConfigured = Boolean(telnyxStatus?.configured);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [model, setModel] = useState(DEFAULT_REALTIME_MODEL_ID);
  const [greeting, setGreeting] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [outboundTo, setOutboundTo] = useState("");
  const [contactName, setContactName] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["telephony-settings", botId],
    queryFn: async () => {
      const settings = await api.get<TelephonySettingsResponse>(
        `/bots/${encodeURIComponent(botId)}/telephony/settings`
      );
      setPhoneNumber(settings.telephonyPhoneNumber ?? "");
      setVoiceId(settings.telephonyVoiceId ?? "");
      setModel(settings.telephonyModel ?? DEFAULT_REALTIME_MODEL_ID);
      setGreeting(settings.telephonyGreeting ?? "");
      setSystemPrompt(settings.telephonySystemPrompt ?? "");
      return settings;
    },
  });

  const { data: numbersData, isLoading: numbersLoading } = useQuery({
    queryKey: ["telephony-numbers"],
    queryFn: () => api.get<{ numbers: TelnyxNumber[] }>("/telephony/numbers"),
    enabled: telnyxConfigured,
  });

  const save = useMutation({
    mutationFn: (payload: SaveTelephonyPayload) =>
      api.put<TelephonySettingsResponse>(
        `/bots/${encodeURIComponent(botId)}/telephony/settings`,
        payload
      ),
    onSuccess: () => {
      setError("");
      setSuccess(t("telephony.saved"));
      void qc.invalidateQueries({ queryKey: ["telephony-settings"] });
      void qc.invalidateQueries({ queryKey: ["telephony-numbers"] });
      void qc.invalidateQueries({ queryKey: ["bots"] });
      setTimeout(() => setSuccess(""), 3000);
    },
    onError: (err: Error) => {
      setSuccess("");
      setError(formatTelephonyError(err.message, t));
    },
  });

  const outboundCall = useMutation({
    mutationFn: () =>
      api.post<{ callId: string; sessionId: string; status: string }>(
        `/bots/${encodeURIComponent(botId)}/telephony/calls`,
        {
          to: outboundTo,
          ...(contactName.trim() ? { contactName: contactName.trim() } : {}),
        }
      ),
    onSuccess: () => {
      setError("");
      setSuccess(t("telephony.outboundStarted"));
      setTimeout(() => setSuccess(""), 3000);
    },
    onError: (err: Error) => {
      setSuccess("");
      setError(err.message);
    },
  });

  const numbers = useMemo(() => numbersData?.numbers ?? [], [numbersData?.numbers]);
  const enabled = Boolean(data?.telephonyEnabled);
  const hasPhoneNumber = phoneNumber.trim().length > 0;
  const systemPromptTooLong = systemPrompt.length > TELEPHONY_SYSTEM_PROMPT_MAX_LENGTH;

  function validateSystemPrompt(): boolean {
    if (!systemPromptTooLong) return true;
    setSuccess("");
    setError(
      t("bots.validationSystemPromptTooLong", { max: TELEPHONY_SYSTEM_PROMPT_MAX_LENGTH })
    );
    return false;
  }

  useEffect(() => {
    if (numbers.length > 0 && !phoneNumber.trim()) {
      setPhoneNumber(numbers[0]!.phoneNumber);
    }
  }, [numbers, phoneNumber]);

  function buildSettingsPayload(includeEnabled?: boolean): SaveTelephonyPayload {
    const payload: SaveTelephonyPayload = {
      telephonyPhoneNumber: phoneNumber.trim(),
      telephonyModel: model,
    };

    if (includeEnabled !== undefined) {
      payload.enabled = includeEnabled;
    }
    if (voiceId.trim()) {
      payload.telephonyVoiceId = voiceId.trim();
    }
    if (greeting.trim()) {
      payload.telephonyGreeting = greeting.trim();
    }
    if (systemPrompt.trim()) {
      payload.telephonySystemPrompt = systemPrompt.trim();
    }

    return payload;
  }

  function validatePhoneNumber(): boolean {
    if (phoneNumber.trim()) return true;
    setSuccess("");
    setError(t("telephony.phoneNumberRequired"));
    return false;
  }

  async function submitSettings(payload: SaveTelephonyPayload) {
    const conflict = getTelephonyNumberAssignment(numbers, phoneNumber.trim(), botId);
    if (conflict) {
      const confirmed = await dialog.confirm({
        title: t("telephony.reassignNumberTitle"),
        description: t("telephony.reassignNumberConfirm", {
          number: phoneNumber.trim(),
          name: conflict.botName ?? conflict.botId,
        }),
      });
      if (!confirmed) return;
      save.mutate({ ...payload, reassignPhoneNumber: true });
      return;
    }
    save.mutate(payload);
  }

  function handleEnabledChange(next: boolean) {
    if (next) {
      if (!validatePhoneNumber() || !validateSystemPrompt()) return;
      setError("");
      void submitSettings(buildSettingsPayload(true));
      return;
    }
    setError("");
    save.mutate({ enabled: false });
  }

  function handleSaveSettings() {
    if (!validatePhoneNumber() || !validateSystemPrompt()) return;
    setError("");
    void submitSettings(buildSettingsPayload());
  }

  const selectedAssignment = getTelephonyNumberAssignment(numbers, phoneNumber.trim(), botId);

  return (
    <div className="bg-surface-elevated rounded-xl border border-default p-6 space-y-4">
      <div className="flex items-center gap-2">
        <PhoneCall className="w-5 h-5 text-accent" />
        <div>
          <h2 className="text-lg font-semibold text-primary">{t("telephony.title")}</h2>
          <p className="text-sm text-secondary">{t("telephony.subtitle")}</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}

      {isLoading ? (
        <div className="h-24 bg-surface-muted rounded animate-pulse" />
      ) : (
        <>
          <TelnyxConnectPanel />

          {telnyxConfigured ? (
          <div className="space-y-4 rounded-xl border border-default bg-surface p-4">
            <label className="block space-y-1">
              <span className="text-sm font-medium text-secondary">{t("telephony.phoneNumber")}</span>
              {numbersLoading ? (
                <div className="h-10 rounded-lg bg-surface-muted animate-pulse" />
              ) : numbers.length > 0 ? (
                <>
                  <select
                    value={phoneNumber}
                    onChange={(e) => {
                      setPhoneNumber(e.target.value);
                      if (error) setError("");
                    }}
                    className="w-full rounded-lg border border-default px-3 py-2 text-sm"
                  >
                    {numbers.map((item) => (
                      <option key={item.id} value={item.phoneNumber}>
                        {item.phoneNumber}
                        {item.assignedBotId && item.assignedBotId !== botId && item.assignedBotName
                          ? ` · ${t("telephonyNumbers.assignedTo", { name: item.assignedBotName })}`
                          : ""}
                      </option>
                    ))}
                  </select>
                  {selectedAssignment ? (
                    <p className="mt-1 text-xs text-amber-700">
                      {t("telephony.phoneNumberAssignedToAgent", {
                        name: selectedAssignment.botName ?? selectedAssignment.botId,
                      })}
                    </p>
                  ) : null}
                </>
              ) : (
                <>
                  <input
                    value={phoneNumber}
                    onChange={(e) => {
                      setPhoneNumber(e.target.value);
                      if (error) setError("");
                    }}
                    placeholder="+17871234567"
                    className="w-full rounded-lg border border-default px-3 py-2 text-sm"
                  />
                  <p className="text-xs text-secondary">{t("telephony.manualNumberHint")}</p>
                </>
              )}
            </label>
          </div>
          ) : null}

          {telnyxConfigured ? (
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
          ) : null}

          {telnyxConfigured && enabled && (
            <>
              <div className="grid grid-cols-1 gap-4 border-t border-subtle pt-4 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-sm font-medium text-secondary">{t("telephony.voiceId")}</span>
                  <input
                    value={voiceId}
                    onChange={(e) => setVoiceId(e.target.value)}
                    placeholder="ElevenLabs voice ID"
                    className="w-full rounded-lg border border-default px-3 py-2 text-sm"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-secondary">{t("telephony.model")}</span>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full rounded-lg border border-default px-3 py-2 text-sm"
                  >
                    {MODELS.map((item) => (
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
                  className="w-full px-3 py-2 border border-default rounded-lg text-sm"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-sm font-medium text-secondary">{t("telephony.systemPrompt")}</span>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={8}
                  maxLength={TELEPHONY_SYSTEM_PROMPT_MAX_LENGTH}
                  className="w-full px-3 py-2 border border-default rounded-lg text-sm"
                />
                <p className="text-xs text-muted">
                  {t("bots.systemPromptCharCount", {
                    current: systemPrompt.length,
                    max: TELEPHONY_SYSTEM_PROMPT_MAX_LENGTH,
                  })}
                </p>
              </label>

              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={save.isPending || systemPromptTooLong}
                className="px-4 py-2 bg-accent text-white text-sm rounded-lg disabled:opacity-50"
              >
                {save.isPending ? t("bots.saving") : t("common.save")}
              </button>

              <div className="border-t border-subtle pt-4 space-y-3">
                <h3 className="text-sm font-semibold text-primary">{t("telephony.outboundTitle")}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    value={outboundTo}
                    onChange={(e) => setOutboundTo(e.target.value)}
                    placeholder={t("telephony.outboundToPlaceholder")}
                    className="w-full px-3 py-2 border border-default rounded-lg text-sm"
                  />
                  <input
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder={t("telephony.contactNamePlaceholder")}
                    className="w-full px-3 py-2 border border-default rounded-lg text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => outboundCall.mutate()}
                  disabled={outboundCall.isPending || !outboundTo.trim()}
                  className="px-4 py-2 border border-accent text-accent text-sm rounded-lg disabled:opacity-50"
                >
                  {outboundCall.isPending ? t("telephony.calling") : t("telephony.startCall")}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
