"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Palette } from "lucide-react";
import { api } from "@/lib/api";
import { useT } from "@/i18n/context";
import { useTenantBranding } from "@/hooks/useTenantBranding";
import { WebchatTestChat } from "@/components/bots/WebchatTestChat";
import { WebchatWidgetPreview } from "@/components/bots/WebchatWidgetPreview";
import type { Bot } from "@/types";

type WebchatSettingsResponse = {
  webchatEnabled: boolean;
  webchatWidgetKey?: string;
  webchatVoiceEnabled?: boolean;
  webchatVideoEnabled?: boolean;
};

type WebchatTab = "config" | "widget" | "preview" | "test";

const TABS: WebchatTab[] = ["config", "widget", "preview", "test"];

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
  const { data: branding } = useTenantBranding();
  const [tab, setTab] = useState<WebchatTab>("config");
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
    <div className="space-y-4">
      <div className="rounded-xl border border-default bg-surface-elevated p-6">
        <div>
          <h2 className="text-lg font-semibold text-primary">{t("webchat.title")}</h2>
          <p className="mt-1 text-sm text-secondary">{t("webchat.subtitle")}</p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-b border-default pb-2">
          {TABS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                tab === item
                  ? "bg-accent text-white"
                  : "text-secondary hover:bg-surface-muted hover:text-primary"
              }`}
            >
              {t(`webchat.tab.${item}`)}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      ) : null}

      {tab === "config" ? (
        <div className="space-y-4 rounded-xl border border-default bg-surface-elevated p-6">
          <label className="flex cursor-pointer items-center justify-between gap-4">
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

          {bot.webchatEnabled ? (
            <>
              <label className="flex cursor-pointer items-center justify-between gap-4 border-t border-subtle pt-4">
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

              <label className="flex cursor-pointer items-center justify-between gap-4">
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
            </>
          ) : null}
        </div>
      ) : null}

      {tab === "widget" ? (
        <div className="space-y-4 rounded-xl border border-default bg-surface-elevated p-6">
          {!bot.webchatEnabled ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {t("webchat.testRequiresEnabled")}
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-default bg-surface p-4">
                <div className="flex items-start gap-3">
                  <Palette className="mt-0.5 h-4 w-4 text-secondary" />
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm font-medium text-primary">{t("webchat.widgetBrandingTitle")}</p>
                      <p className="text-sm text-secondary">{t("webchat.widgetBrandingHint")}</p>
                    </div>
                    <Link
                      href="/settings"
                      className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
                    >
                      {t("webchat.widgetBrandingLink")}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-secondary">{t("webchat.widgetKey")}</p>
                  <code className="block break-all rounded-lg border border-default bg-surface p-3 text-xs">
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
                    className="w-full rounded-lg border border-default bg-surface p-3 font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => void copySnippet()}
                    className="rounded-lg bg-accent px-4 py-2 text-sm text-white"
                  >
                    {copied ? t("webchat.copied") : t("webchat.copy")}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      ) : null}

      {tab === "preview" ? (
        <div className="rounded-xl border border-default bg-surface-elevated p-6">
          {!bot.webchatEnabled ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {t("webchat.testRequiresEnabled")}
            </div>
          ) : (
            <WebchatWidgetPreview branding={branding} brandNameFallback={bot.name} />
          )}
        </div>
      ) : null}

      {tab === "test" ? (
        <div className="rounded-xl border border-default bg-surface-elevated p-6">
          <WebchatTestChat
            botId={bot.botId}
            widgetKey={bot.webchatWidgetKey}
            enabled={Boolean(bot.webchatEnabled)}
            branding={branding}
            brandNameFallback={bot.name}
          />
        </div>
      ) : null}
    </div>
  );
}
