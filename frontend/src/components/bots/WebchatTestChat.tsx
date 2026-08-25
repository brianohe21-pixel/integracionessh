"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUp,
  Bot,
  ExternalLink,
  MessageSquare,
  Monitor,
  MoreVertical,
  RotateCcw,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useWebchatTest } from "@/hooks/useWebchatTest";
import { useLocale, useT } from "@/i18n/context";
import { Button } from "@/components/ui/Button";
import { DEFAULT_PRIMARY_COLOR } from "@/lib/brand-colors";
import { cn } from "@/lib/utils";
import type { ResolvedTenantBranding } from "@/types";

interface WebchatTestChatProps {
  botId: string;
  widgetKey?: string;
  enabled: boolean;
  branding?: ResolvedTenantBranding;
  brandNameFallback?: string;
}

const QUICK_PROMPT_KEYS = ["greeting", "pricing", "support"] as const;

function formatMessageTime(iso: string, locale: "es" | "en") {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function TypingIndicator({ color }: { color: string }) {
  return (
    <div className="flex items-center gap-1 rounded-2xl border border-default bg-white px-3 py-2.5 shadow-sm">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="h-1.5 w-1.5 rounded-full animate-pulse"
          style={{
            backgroundColor: color,
            animationDelay: `${index * 150}ms`,
          }}
        />
      ))}
    </div>
  );
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "neutral" | "success" | "warning" | "danger";
}) {
  const tones = {
    neutral: "border-default bg-surface text-secondary",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    danger: "border-red-200 bg-red-50 text-red-700",
  };

  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium", tones[tone])}>
      <span
        className={cn(
          "mr-1.5 h-1.5 w-1.5 rounded-full",
          tone === "success" && "bg-emerald-500",
          tone === "warning" && "bg-amber-500 animate-pulse",
          tone === "danger" && "bg-red-500",
          tone === "neutral" && "bg-secondary"
        )}
      />
      {label}
    </span>
  );
}

export function WebchatTestChat({
  botId,
  widgetKey,
  enabled,
  branding,
  brandNameFallback,
}: WebchatTestChatProps) {
  const t = useT();
  const locale = useLocale();
  const [draft, setDraft] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmEndOpen, setConfirmEndOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const {
    messages,
    conversationId,
    status,
    error,
    sessionEnded,
    actionPending,
    send,
    reset,
    endConversation,
    requestHandoff,
    startNewConversation,
  } = useWebchatTest({
    botId,
    widgetKey,
    enabled,
  });

  const brandName = branding?.brandName?.trim() || brandNameFallback || t("webchat.previewBrandFallback");
  const primaryColor = branding?.primaryColor || DEFAULT_PRIMARY_COLOR;

  const statusLabel = useMemo(() => {
    if (status === "connecting") return t("webchat.testStatusConnecting");
    if (status === "sending") return t("webchat.testStatusSending");
    if (status === "ready") return t("webchat.testStatusConnected");
    if (status === "error") return t("webchat.testStatusError");
    return t("webchat.testStatusIdle");
  }, [status, t]);

  const statusTone = useMemo(() => {
    if (status === "ready") return "success" as const;
    if (status === "connecting" || status === "sending") return "warning" as const;
    if (status === "error") return "danger" as const;
    return "neutral" as const;
  }, [status]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

  if (!enabled) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
        {t("webchat.testRequiresEnabled")}
      </div>
    );
  }

  if (!widgetKey) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
        {t("webchat.testRequiresKey")}
      </div>
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const value = draft;
    setDraft("");
    await send(value);
  }

  async function handleQuickPrompt(key: (typeof QUICK_PROMPT_KEYS)[number]) {
    const value = t(`webchat.testQuickPrompts.${key}`);
    setDraft("");
    await send(value);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
      <aside className="space-y-4">
        <div className="rounded-xl border border-default bg-surface p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-accent/10 p-2 text-accent">
              <MessageSquare className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-primary">{t("webchat.testTitle")}</h3>
              <p className="mt-1 text-sm text-secondary">{t("webchat.testSubtitle")}</p>
            </div>
          </div>
          <div className="mt-4">
            <StatusPill label={statusLabel} tone={statusTone} />
          </div>
        </div>

        <div className="rounded-xl border border-default bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
            {t("webchat.testTipsTitle")}
          </p>
          <ul className="mt-3 space-y-2 text-sm text-secondary">
            <li className="flex gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span>{t("webchat.testTip1")}</span>
            </li>
            <li className="flex gap-2">
              <Bot className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span>{t("webchat.testTip2")}</span>
            </li>
          </ul>
        </div>

        <div className="rounded-xl border border-default bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
            {t("webchat.testQuickPromptsTitle")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {QUICK_PROMPT_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => void handleQuickPrompt(key)}
                disabled={status === "connecting" || status === "sending"}
                className="rounded-full border border-default bg-surface-elevated px-3 py-1.5 text-left text-xs text-primary transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
              >
                {t(`webchat.testQuickPrompts.${key}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {conversationId ? (
            <Link
              href={`/inbox?conversation=${encodeURIComponent(conversationId)}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-default bg-surface-elevated px-3 py-2 text-sm font-medium text-accent hover:bg-surface-muted"
            >
              {t("webchat.testOpenInbox")}
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          ) : null}
          <Button type="button" variant="secondary" size="sm" onClick={reset}>
            <RotateCcw className="h-3.5 w-3.5" />
            {t("webchat.testReset")}
          </Button>
        </div>
      </aside>

      <div className="overflow-hidden rounded-xl border border-default bg-surface">
        <div className="flex items-center gap-2 border-b border-default bg-surface-muted px-4 py-2">
          <Monitor className="h-4 w-4 text-secondary" />
          <span className="text-xs text-secondary">{t("webchat.testSandboxLabel")}</span>
        </div>

        <div className="relative min-h-[520px] bg-gradient-to-br from-slate-100 to-slate-200 p-6 dark:from-slate-900 dark:to-slate-800">
          <div className="max-w-md space-y-3 opacity-50">
            <div className="h-4 w-40 rounded bg-slate-300 dark:bg-slate-700" />
            <div className="h-3 w-full rounded bg-slate-300/80 dark:bg-slate-700/80" />
            <div className="h-3 w-5/6 rounded bg-slate-300/80 dark:bg-slate-700/80" />
            <div className="h-3 w-2/3 rounded bg-slate-300/80 dark:bg-slate-700/80" />
          </div>

          <div className="absolute bottom-5 right-5 flex w-[min(100%,22rem)] flex-col items-end gap-2">
            <div className="relative flex h-[420px] w-full flex-col overflow-hidden rounded-2xl border border-default bg-white shadow-2xl">
              <div
                className="flex items-center gap-2 px-4 py-3 text-sm font-semibold text-white"
                style={{ backgroundColor: primaryColor }}
              >
                {branding?.logoUrl ? (
                  <img src={branding.logoUrl} alt="" className="h-7 w-7 rounded-md object-cover" />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white/15 text-xs font-bold">
                    {brandName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate">{brandName}</p>
                  <p className="text-[11px] font-normal opacity-90">{t("webchat.testVisitorMode")}</p>
                </div>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setMenuOpen((value) => !value)}
                    disabled={sessionEnded || actionPending}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white/90 transition-colors hover:bg-white/10 disabled:opacity-40"
                    aria-label={t("webchat.visitorMenu")}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {menuOpen ? (
                    <div className="absolute right-0 top-10 z-20 min-w-[190px] overflow-hidden rounded-xl border border-default bg-white text-primary shadow-xl">
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          void requestHandoff();
                        }}
                        disabled={actionPending}
                        className="block w-full px-3 py-2.5 text-left text-sm hover:bg-surface-muted disabled:opacity-50"
                      >
                        {t("webchat.talkToAdvisor")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          setConfirmEndOpen(true);
                        }}
                        disabled={actionPending}
                        className="block w-full border-t border-default px-3 py-2.5 text-left text-sm text-danger hover:bg-danger/5 disabled:opacity-50"
                      >
                        {t("webchat.endConversation")}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col bg-slate-50">
                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                  {messages.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center px-4 text-center">
                      <div
                        className="mb-3 flex h-12 w-12 items-center justify-center rounded-full text-white"
                        style={{ backgroundColor: primaryColor }}
                      >
                        <MessageSquare className="h-5 w-5" />
                      </div>
                      <p className="text-sm font-medium text-primary">{t("webchat.testEmptyTitle")}</p>
                      <p className="mt-1 text-xs text-secondary">{t("webchat.testEmpty")}</p>
                    </div>
                  ) : (
                    messages.map((message) => {
                      const isVisitor = message.role === "user";
                      const isSystem = message.role === "system";

                      if (isSystem) {
                        return (
                          <p key={message.id} className="text-center text-[11px] text-secondary">
                            {message.content}
                          </p>
                        );
                      }

                      return (
                        <div
                          key={message.id}
                          className={cn("flex gap-2", isVisitor ? "justify-end" : "justify-start")}
                        >
                          {!isVisitor ? (
                            <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-accent shadow-sm">
                              <Bot className="h-3.5 w-3.5" />
                            </div>
                          ) : null}

                          <div className={cn("max-w-[82%]", isVisitor ? "items-end" : "items-start")}>
                            <p className="mb-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-secondary">
                              {isVisitor ? (
                                <>
                                  <UserRound className="h-3 w-3" />
                                  {t("webchat.testVisitorLabel")}
                                </>
                              ) : (
                                <>
                                  <Bot className="h-3 w-3" />
                                  {t("webchat.testAgentLabel")}
                                </>
                              )}
                            </p>
                            <div
                              className={cn(
                                "rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm",
                                isVisitor
                                  ? "rounded-br-md text-white"
                                  : "rounded-bl-md border border-default bg-white text-primary"
                              )}
                              style={isVisitor ? { backgroundColor: primaryColor } : undefined}
                            >
                              <p className="whitespace-pre-wrap break-words">{message.content}</p>
                              <p
                                className={cn(
                                  "mt-1 text-[10px] leading-none",
                                  isVisitor ? "text-white/75" : "text-secondary"
                                )}
                              >
                                {formatMessageTime(message.timestamp, locale)}
                              </p>
                            </div>
                          </div>

                          {isVisitor ? (
                            <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-secondary shadow-sm">
                              <UserRound className="h-3.5 w-3.5" />
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  )}

                  {status === "sending" ? (
                    <div className="flex items-start gap-2">
                      <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-accent shadow-sm">
                        <Bot className="h-3.5 w-3.5" />
                      </div>
                      <TypingIndicator color={primaryColor} />
                    </div>
                  ) : null}

                  <div ref={messagesEndRef} />
                </div>

                {error ? (
                  <div className="border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">
                    {error}
                  </div>
                ) : null}

                {sessionEnded ? (
                  <div className="border-t border-default bg-surface-muted px-4 py-4 text-center">
                    <p className="text-sm font-medium text-primary">{t("webchat.conversationEnded")}</p>
                    <Button
                      type="button"
                      size="sm"
                      className="mt-3"
                      onClick={startNewConversation}
                      style={{ backgroundColor: primaryColor }}
                    >
                      {t("webchat.startNewConversation")}
                    </Button>
                  </div>
                ) : (
                  <form
                    onSubmit={(event) => void handleSubmit(event)}
                    className="border-t border-default bg-white p-3"
                  >
                    <div className="flex items-end gap-2">
                      <textarea
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            if (!draft.trim() || status === "connecting" || status === "sending") return;
                            void handleSubmit(event);
                          }
                        }}
                        placeholder={t("webchat.testPlaceholder")}
                        disabled={status === "connecting" || actionPending}
                        rows={2}
                        className="max-h-24 min-h-[2.75rem] flex-1 resize-none rounded-xl border border-default px-3 py-2 text-sm"
                      />
                      <button
                        type="submit"
                        disabled={!draft.trim() || status === "connecting" || status === "sending" || actionPending}
                        className="flex h-10 w-10 items-center justify-center rounded-full text-white transition-opacity disabled:opacity-40"
                        style={{ backgroundColor: primaryColor }}
                        aria-label={t("webchat.testSend")}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="mt-2 text-[11px] text-secondary">{t("webchat.testInputHint")}</p>
                  </form>
                )}
              </div>
            </div>

            {confirmEndOpen ? (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
                <div className="w-full max-w-xs rounded-xl border border-default bg-white p-4 shadow-xl">
                  <h3 className="text-sm font-semibold text-primary">{t("webchat.endConfirmTitle")}</h3>
                  <p className="mt-2 text-sm text-secondary">{t("webchat.endConfirmBody")}</p>
                  <div className="mt-4 flex justify-end gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmEndOpen(false)}>
                      {t("common.cancel")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setConfirmEndOpen(false);
                        void endConversation();
                      }}
                      disabled={actionPending}
                    >
                      {t("webchat.endConfirmYes")}
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            <button
              type="button"
              className="flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg"
              style={{
                backgroundColor: primaryColor,
                boxShadow: `0 4px 14px ${primaryColor}66`,
              }}
              aria-label={brandName}
            >
              <MessageSquare className="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
