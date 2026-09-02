"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronRight, Copy, Play, Terminal } from "lucide-react";
import { useT } from "@/i18n/context";
import { useWhatsAppTestSend } from "@/hooks/useWhatsAppChannels";
import { Button } from "@/components/ui/Button";
import {
  buildWhatsAppCloudApiTemplateCurl,
  normalizeWhatsAppRecipientPhone,
  parseWhatsAppCloudApiTemplateCurl,
} from "@/lib/whatsapp-cloud-api-curl";
import { cn } from "@/lib/utils";
import type { Bot, WhatsAppChannel } from "@/types";

interface BotWhatsAppCloudApiTestProps {
  bot: Bot;
  channels: WhatsAppChannel[];
}

function activeChannels(channels: WhatsAppChannel[]): WhatsAppChannel[] {
  return channels.filter((channel) => channel.status === "active");
}

export function BotWhatsAppCloudApiTest({ bot, channels }: BotWhatsAppCloudApiTestProps) {
  const t = useT();
  const testSend = useWhatsAppTestSend(bot.botId);
  const eligibleChannels = useMemo(() => activeChannels(channels), [channels]);
  const legacyPhoneNumberId = bot.phoneNumberId?.trim() ?? "";
  const hasLegacy = Boolean(legacyPhoneNumberId) && eligibleChannels.length === 0;

  const defaultChannelId =
    eligibleChannels.find((channel) => channel.isDefault)?.channelId ??
    eligibleChannels[0]?.channelId ??
    "";

  const [channelId, setChannelId] = useState("");
  const effectiveChannelId = channelId || defaultChannelId;
  const [to, setTo] = useState("573223117078");
  const [templateName, setTemplateName] = useState("hello_world");
  const [language, setLanguage] = useState("en_US");
  const [expanded, setExpanded] = useState(false);
  const [curlText, setCurlText] = useState("");
  const [curlDirty, setCurlDirty] = useState(false);
  const [copied, setCopied] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [resultError, setResultError] = useState<string | null>(null);
  const copyTimeoutRef = useRef<number | null>(null);

  const selectedChannel = eligibleChannels.find((channel) => channel.channelId === effectiveChannelId);
  const phoneNumberId = selectedChannel?.phoneNumberId ?? legacyPhoneNumberId;
  const normalizedTo = normalizeWhatsAppRecipientPhone(to);

  const generatedCurl = useMemo(
    () =>
      phoneNumberId
        ? buildWhatsAppCloudApiTemplateCurl({
            phoneNumberId,
            to: normalizedTo || "573223117078",
            templateName: templateName.trim() || "hello_world",
            language: language.trim() || "en_US",
          })
        : "",
    [phoneNumberId, normalizedTo, templateName, language]
  );

  useEffect(() => {
    if (!curlDirty && generatedCurl) {
      setCurlText(generatedCurl);
    }
  }, [curlDirty, generatedCurl]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  if (!phoneNumberId) return null;

  function resolveSendPayload() {
    const parsed = parseWhatsAppCloudApiTemplateCurl(curlText);
    const resolvedTo = parsed.to ?? normalizedTo;
    const resolvedTemplate = parsed.templateName ?? (templateName.trim() || "hello_world");
    const resolvedLanguage = parsed.language ?? (language.trim() || "en_US");
    const resolvedPhoneNumberId = parsed.phoneNumberId ?? phoneNumberId;

    return {
      to: resolvedTo,
      templateName: resolvedTemplate,
      language: resolvedLanguage,
      phoneNumberId: resolvedPhoneNumberId !== phoneNumberId ? resolvedPhoneNumberId : undefined,
      canSend: Boolean(resolvedPhoneNumberId && resolvedTo.length >= 10),
    };
  }

  async function handleCopyCurl() {
    try {
      await navigator.clipboard.writeText(curlText);
      setCopied(true);
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  function handleRegenerateCurl() {
    setCurlDirty(false);
    setCurlText(generatedCurl);
  }

  async function handleSend() {
    const payload = resolveSendPayload();
    if (!payload.canSend) return;

    setResultMessage(null);
    setResultError(null);

    try {
      const response = await testSend.mutateAsync({
        ...(selectedChannel ? { channelId: selectedChannel.channelId } : {}),
        to: payload.to,
        templateName: payload.templateName,
        language: payload.language,
        ...(payload.phoneNumberId ? { phoneNumberId: payload.phoneNumberId } : {}),
      });
      setResultMessage(
        t("whatsapp.cloudApiTest.success", {
          messageId: response.messageId ?? "—",
        })
      );
    } catch (err) {
      setResultError((err as Error).message ?? t("whatsapp.cloudApiTest.error"));
    }
  }

  const sendPayload = resolveSendPayload();

  return (
    <div className="rounded-lg border border-accent/20 bg-accent-muted/20">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-accent-muted/30"
      >
        {expanded ? (
          <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
        ) : (
          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
        )}
        <div className="rounded-lg bg-accent/10 p-2 text-accent">
          <Terminal className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-primary">{t("whatsapp.cloudApiTest.title")}</h3>
          <p className="mt-1 text-sm text-secondary">{t("whatsapp.cloudApiTest.description")}</p>
        </div>
      </button>

      <div
        className={cn(
          "overflow-hidden transition-all",
          expanded ? "max-h-[4000px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="space-y-4 border-t border-accent/10 px-4 pb-4 pt-2">
          {eligibleChannels.length > 1 ? (
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary">
                {t("whatsapp.cloudApiTest.channelLabel")}
              </label>
              <select
                value={effectiveChannelId}
                onChange={(e) => setChannelId(e.target.value)}
                className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm"
              >
                {eligibleChannels.map((channel) => (
                  <option key={channel.channelId} value={channel.channelId}>
                    {channel.displayPhoneNumber?.trim() || channel.phoneNumberId}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary">
                {t("whatsapp.cloudApiTest.toLabel")}
              </label>
              <input
                type="text"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full rounded-lg border border-default px-3 py-2 font-mono text-sm"
                placeholder="573223117078"
              />
              <p className="mt-1 text-xs text-muted">{t("whatsapp.cloudApiTest.toHint")}</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary">
                {t("whatsapp.cloudApiTest.phoneNumberIdLabel")}
              </label>
              <input
                type="text"
                readOnly
                value={phoneNumberId}
                className="w-full rounded-lg border border-default bg-surface-muted px-3 py-2 font-mono text-sm text-secondary"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary">
                {t("whatsapp.cloudApiTest.templateLabel")}
              </label>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="w-full rounded-lg border border-default px-3 py-2 font-mono text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary">
                {t("whatsapp.cloudApiTest.languageLabel")}
              </label>
              <input
                type="text"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full rounded-lg border border-default px-3 py-2 font-mono text-sm"
              />
            </div>
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <label className="text-sm font-medium text-secondary">
                {t("whatsapp.cloudApiTest.curlLabel")}
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {curlDirty ? (
                  <button
                    type="button"
                    onClick={handleRegenerateCurl}
                    className="text-xs font-medium text-accent hover:underline"
                  >
                    {t("whatsapp.cloudApiTest.regenerateCurl")}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void handleCopyCurl()}
                  className="inline-flex items-center gap-1.5 rounded-md border border-default px-2 py-1 text-xs font-medium text-secondary hover:bg-surface-muted"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-accent" />
                      {t("apiDocs.copied")}
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      {t("apiDocs.copy")}
                    </>
                  )}
                </button>
              </div>
            </div>
            <textarea
              value={curlText}
              onChange={(e) => {
                setCurlDirty(true);
                setCurlText(e.target.value);
              }}
              spellCheck={false}
              rows={12}
              className="w-full rounded-xl border border-default bg-[#0c1220] px-4 py-3 font-mono text-[12.5px] leading-relaxed text-slate-200 focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={() => void handleSend()}
              disabled={!sendPayload.canSend || testSend.isPending}
            >
              <Play className="h-4 w-4" />
              {testSend.isPending ? t("whatsapp.cloudApiTest.sending") : t("whatsapp.cloudApiTest.sendButton")}
            </Button>
          </div>

          {hasLegacy ? (
            <p className="text-xs text-muted">{t("whatsapp.cloudApiTest.legacyHint")}</p>
          ) : null}

          {resultMessage ? (
            <div className="rounded-lg border border-success/20 bg-success/10 p-3 text-sm text-success">
              {resultMessage}
            </div>
          ) : null}

          {resultError ? (
            <div className="rounded-lg border border-danger/20 bg-[var(--alert-danger-bg)] p-3 text-sm text-danger">
              {resultError}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
