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
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{t("webchat.title")}</h2>
        <p className="text-sm text-gray-500 mt-1">{t("webchat.subtitle")}</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-medium text-gray-900">{t("webchat.enableLabel")}</p>
          <p className="text-sm text-gray-500">{t("webchat.enableHint")}</p>
        </div>
        <button
          type="button"
          onClick={() => updateSettings.mutate({ enabled: !bot.webchatEnabled })}
          disabled={updateSettings.isPending}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            bot.webchatEnabled ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"
          }`}
        >
          {bot.webchatEnabled ? t("webchat.enabled") : t("webchat.disabled")}
        </button>
      </div>

      {bot.webchatEnabled && (
        <>
          <div className="flex items-center justify-between gap-4 border-t border-gray-100 pt-4">
            <div>
              <p className="font-medium text-gray-900">{t("webchat.voiceLabel")}</p>
              <p className="text-sm text-gray-500">{t("webchat.voiceHint")}</p>
            </div>
            <button
              type="button"
              onClick={() =>
                updateSettings.mutate({ webchatVoiceEnabled: !bot.webchatVoiceEnabled })
              }
              disabled={updateSettings.isPending}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                bot.webchatVoiceEnabled ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"
              }`}
            >
              {bot.webchatVoiceEnabled ? t("webchat.enabled") : t("webchat.disabled")}
            </button>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-gray-900">{t("webchat.videoLabel")}</p>
              <p className="text-sm text-gray-500">{t("webchat.videoHint")}</p>
            </div>
            <button
              type="button"
              onClick={() =>
                updateSettings.mutate({
                  webchatVideoEnabled: !bot.webchatVideoEnabled,
                  webchatVoiceEnabled: true,
                })
              }
              disabled={updateSettings.isPending || !bot.webchatVoiceEnabled}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                bot.webchatVideoEnabled ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"
              } disabled:opacity-50`}
            >
              {bot.webchatVideoEnabled ? t("webchat.enabled") : t("webchat.disabled")}
            </button>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 border-t border-gray-100 pt-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">{t("webchat.widgetKey")}</p>
              <code className="block text-xs bg-gray-50 border border-gray-200 rounded-lg p-3 break-all">
                {bot.webchatWidgetKey}
              </code>
              <button
                type="button"
                onClick={() => rotateKey.mutate()}
                disabled={rotateKey.isPending}
                className="text-sm text-indigo-600 hover:underline"
              >
                {t("webchat.rotateKey")}
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">{t("webchat.embedSnippet")}</p>
              <textarea
                readOnly
                value={snippet}
                rows={4}
                className="w-full text-xs font-mono border border-gray-200 rounded-lg p-3 bg-gray-50"
              />
              <button
                type="button"
                onClick={() => void copySnippet()}
                className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg"
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
