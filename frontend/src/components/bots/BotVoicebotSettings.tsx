"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useT } from "@/i18n/context";
import type { Bot } from "@/types";

type VoicebotSettingsResponse = {
  voicebotEnabled?: boolean;
  voicebotWidgetKey?: string;
  voicebotVoice?: string;
  voicebotModel?: string;
  voicebotGreeting?: string;
  voicebotSystemPrompt?: string;
};

const VOICES = ["alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse"];
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

export function BotVoicebotSettings({ bot }: { bot: Bot }) {
  const t = useT();
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [voice, setVoice] = useState(bot.voicebotVoice ?? "alloy");
  const [model, setModel] = useState(bot.voicebotModel ?? "gpt-realtime-2.1-mini");
  const [greeting, setGreeting] = useState(bot.voicebotGreeting ?? "");
  const [systemPrompt, setSystemPrompt] = useState(
    bot.voicebotSystemPrompt ?? bot.systemPrompt ?? ""
  );

  const save = useMutation({
    mutationFn: (payload: VoicebotSettingsResponse & { enabled?: boolean }) =>
      api.put<VoicebotSettingsResponse>(`/bots/${encodeURIComponent(bot.botId)}/voicebot`, payload),
    onSuccess: () => {
      setError("");
      void qc.invalidateQueries({ queryKey: ["bots", "detail", bot.botId] });
      void qc.invalidateQueries({ queryKey: ["bots", "list"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const rotateKey = useMutation({
    mutationFn: () =>
      api.post<VoicebotSettingsResponse>(
        `/bots/${encodeURIComponent(bot.botId)}/voicebot/rotate-key`,
        {}
      ),
    onSuccess: () => {
      setError("");
      void qc.invalidateQueries({ queryKey: ["bots", "detail", bot.botId] });
      void qc.invalidateQueries({ queryKey: ["bots", "list"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
  const snippet =
    bot.voicebotWidgetKey && apiUrl
      ? `<script src="${typeof window !== "undefined" ? window.location.origin : ""}/widget-voice.bundle.js" data-api-url="${apiUrl}" data-bot-id="${bot.botId}" data-widget-key="${bot.voicebotWidgetKey}"></script>`
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
        <h2 className="text-lg font-semibold text-primary">{t("voicebot.title")}</h2>
        <p className="text-sm text-secondary mt-1">{t("voicebot.subtitle")}</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <label className="flex items-center justify-between gap-4 cursor-pointer">
        <div>
          <p className="font-medium text-primary">{t("voicebot.enableLabel")}</p>
          <p className="text-sm text-secondary">{t("voicebot.enableHint")}</p>
        </div>
        <SettingsSwitch
          checked={Boolean(bot.voicebotEnabled)}
          disabled={save.isPending}
          onChange={(enabled) => save.mutate({ enabled })}
        />
      </label>

      {bot.voicebotEnabled && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-subtle pt-4">
            <label className="space-y-1">
              <span className="text-sm font-medium text-secondary">{t("voicebot.voice")}</span>
              <select
                value={voice}
                onChange={(e) => setVoice(e.target.value)}
                className="w-full px-3 py-2 border border-default rounded-lg text-sm"
              >
                {VOICES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-secondary">{t("voicebot.model")}</span>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3 py-2 border border-default rounded-lg text-sm"
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
            <span className="text-sm font-medium text-secondary">{t("voicebot.greeting")}</span>
            <input
              value={greeting}
              onChange={(e) => setGreeting(e.target.value)}
              placeholder={t("voicebot.greetingPlaceholder")}
              className="w-full px-3 py-2 border border-default rounded-lg text-sm"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-secondary">{t("voicebot.systemPrompt")}</span>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={5}
              className="w-full px-3 py-2 border border-default rounded-lg text-sm"
            />
          </label>

          <button
            type="button"
            onClick={() =>
              save.mutate({
                voicebotVoice: voice,
                voicebotModel: model,
                voicebotGreeting: greeting,
                voicebotSystemPrompt: systemPrompt,
              })
            }
            disabled={save.isPending}
            className="px-4 py-2 bg-accent text-white text-sm rounded-lg disabled:opacity-50"
          >
            {save.isPending ? t("common.saving") : t("common.save")}
          </button>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 border-t border-subtle pt-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-secondary">{t("voicebot.widgetKey")}</p>
              <code className="block text-xs bg-surface border border-default rounded-lg p-3 break-all">
                {bot.voicebotWidgetKey}
              </code>
              <button
                type="button"
                onClick={() => rotateKey.mutate()}
                disabled={rotateKey.isPending}
                className="text-sm text-accent hover:underline"
              >
                {t("voicebot.rotateKey")}
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-secondary">{t("voicebot.embedSnippet")}</p>
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
                {copied ? t("voicebot.copied") : t("voicebot.copy")}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
