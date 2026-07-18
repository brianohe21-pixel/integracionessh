"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useT } from "@/i18n/context";
import type { Bot } from "@/types";

type WebchatSettingsResponse = {
  webchatEnabled: boolean;
  webchatWidgetKey?: string;
  webchatVoiceEnabled?: boolean;
  webchatVideoEnabled?: boolean;
};

function patchBotWebchatCache(
  qc: ReturnType<typeof useQueryClient>,
  botId: string,
  patch: Partial<WebchatSettingsResponse>
) {
  qc.setQueryData<Bot>(["bots", "detail", botId], (prev) =>
    prev ? { ...prev, ...patch } : prev
  );
}

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

export function BotWebchatSettings({ bot }: { bot: Bot }) {
  const t = useT();
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const updateSettings = useMutation({
    mutationFn: (payload: {
      enabled?: boolean;
      webchatVoiceEnabled?: boolean;
      webchatVideoEnabled?: boolean;
    }) =>
      api.put<WebchatSettingsResponse>(
        `/bots/${encodeURIComponent(bot.botId)}/webchat`,
        payload
      ),
    onSuccess: (data) => {
      setError("");
      patchBotWebchatCache(qc, bot.botId, data);
      void qc.invalidateQueries({ queryKey: ["bots", "detail", bot.botId] });
      void qc.invalidateQueries({ queryKey: ["bots", "list"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const rotateKey = useMutation({
    mutationFn: () =>
      api.post<WebchatSettingsResponse>(
        `/bots/${encodeURIComponent(bot.botId)}/webchat/rotate-key`,
        {}
      ),
    onSuccess: (data) => {
      setError("");
      patchBotWebchatCache(qc, bot.botId, data);
      void qc.invalidateQueries({ queryKey: ["bots", "detail", bot.botId] });
      void qc.invalidateQueries({ queryKey: ["bots", "list"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
  const snippet =
    bot.webchatWidgetKey && apiUrl
      ? `<script src="${typeof window !== "undefined" ? window.location.origin : ""}/widget.js" data-api-url="${apiUrl}" data-bot-id="${bot.botId}" data-widget-key="${bot.webchatWidgetKey}"></script>`
      : "";

  async function copySnippet() {
    if (!snippet) return;
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-surface-elevated rounded-xl border border-default p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-primary">{t("webchat.title")}</h2>
        <p className="text-sm text-secondary mt-1">{t("webchat.subtitle")}</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <label className="flex items-center justify-between gap-4 cursor-pointer">
        <div>
          <p className="font-medium text-primary">{t("webchat.enableLabel")}</p>
          <p className="text-sm text-secondary">{t("webchat.enableHint")}</p>
        </div>
        <SettingsSwitch
          checked={Boolean(bot.webchatEnabled)}
          disabled={updateSettings.isPending}
          onChange={(enabled) => updateSettings.mutate({ enabled })}
        />
      </label>

      {bot.webchatEnabled && (
        <>
          <label className="flex items-center justify-between gap-4 cursor-pointer border-t border-subtle pt-4">
            <div>
              <p className="font-medium text-primary">{t("webchat.voiceLabel")}</p>
              <p className="text-sm text-secondary">{t("webchat.voiceHint")}</p>
            </div>
            <SettingsSwitch
              checked={Boolean(bot.webchatVoiceEnabled)}
              disabled={updateSettings.isPending}
              onChange={(webchatVoiceEnabled) =>
                updateSettings.mutate({ webchatVoiceEnabled })
              }
            />
          </label>

          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <div>
              <p className="font-medium text-primary">{t("webchat.videoLabel")}</p>
              <p className="text-sm text-secondary">{t("webchat.videoHint")}</p>
            </div>
            <SettingsSwitch
              checked={Boolean(bot.webchatVideoEnabled)}
              disabled={updateSettings.isPending || !bot.webchatVoiceEnabled}
              onChange={(webchatVideoEnabled) =>
                updateSettings.mutate({
                  webchatVideoEnabled,
                  webchatVoiceEnabled: true,
                })
              }
            />
          </label>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 border-t border-subtle pt-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-secondary">{t("webchat.widgetKey")}</p>
              <code className="block text-xs bg-surface border border-default rounded-lg p-3 break-all">
                {bot.webchatWidgetKey}
              </code>
              <button
                type="button"
                onClick={() => rotateKey.mutate()}
                disabled={rotateKey.isPending}
                className="text-sm text-accent hover:underline"
              >
                {t("webchat.rotateKey")}
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-secondary">{t("webchat.embedSnippet")}</p>
              <textarea
                readOnly
                value={snippet}
                rows={4}
                className="w-full text-xs font-mono border border-default rounded-lg p-3 bg-surface"
              />
              <button
                type="button"
                onClick={() => void copySnippet()}
                className="px-4 py-2 bg-accent text-white text-sm rounded-lg"
              >
                {copied ? t("webchat.copied") : t("webchat.copy")}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
