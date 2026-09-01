"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useCopilotAnalyze, useCopilotSuggest } from "@/hooks/useCopilot";
import { useT } from "@/i18n/context";
import { cn } from "@/lib/utils";
import type { Conversation, Tenant } from "@/types";

interface AdvisorCopilotPanelProps {
  conversation: Conversation;
  onInsertSuggestion: (text: string) => void;
}

function intentLabelKey(intent: string): string {
  const normalized = intent.trim().toLowerCase();
  const known = [
    "consulta",
    "soporte",
    "ventas",
    "reclamo",
    "agendamiento",
    "seguimiento",
    "otro",
  ];
  return known.includes(normalized) ? normalized : "otro";
}

export function AdvisorCopilotPanel({
  conversation,
  onInsertSuggestion,
}: AdvisorCopilotPanelProps) {
  const t = useT();
  const { data: tenant } = useQuery({
    queryKey: ["tenant"],
    queryFn: () => api.get<Tenant>("/tenants/me"),
  });
  const analyze = useCopilotAnalyze();
  const suggest = useCopilotSuggest();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(false);
  }, [conversation.conversationId]);

  if (tenant?.plan === "free") {
    return null;
  }

  const detectedIntent = conversation.detectedIntent;
  const copilotSummary = conversation.copilotSummary;
  const isLoading = analyze.isPending || suggest.isPending;
  const error = analyze.error ?? suggest.error;
  const intentKey = detectedIntent ? intentLabelKey(detectedIntent) : null;
  const hasInsights = Boolean(intentKey || copilotSummary);

  async function handleAnalyze() {
    await analyze.mutateAsync({
      conversationId: conversation.conversationId,
      botId: conversation.botId,
    });
    setExpanded(true);
  }

  async function handleSuggest() {
    const result = await suggest.mutateAsync({
      conversationId: conversation.conversationId,
      botId: conversation.botId,
    });
    if (result.suggestion) {
      onInsertSuggestion(result.suggestion);
    }
  }

  return (
    <div className="conversations-copilot border-t border-default px-4 py-2.5 sm:px-6">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1 text-left transition-colors hover:bg-surface-muted"
        >
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-muted text-accent">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-primary">
              {t("conversations.copilot.title")}
            </span>
            {!expanded ? (
              <span className="block truncate text-[11px] text-secondary">
                {copilotSummary?.trim() ||
                  (intentKey
                    ? t(`conversations.copilot.intents.${intentKey}`)
                    : t("conversations.copilot.noInsights"))}
              </span>
            ) : null}
          </span>
          {intentKey && !expanded ? (
            <Badge variant="info" className="shrink-0">
              {t(`conversations.copilot.intents.${intentKey}`)}
            </Badge>
          ) : null}
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted transition-transform duration-200",
              expanded && "rotate-180"
            )}
          />
        </button>

        {!expanded ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void handleSuggest()}
            disabled={isLoading}
            className="shrink-0"
          >
            {suggest.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">{t("conversations.copilot.suggest")}</span>
          </Button>
        ) : null}
      </div>

      {expanded ? (
        <div className="mt-3 space-y-3">
          <div className="space-y-2 text-sm">
            {intentKey ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-secondary">{t("conversations.copilot.intent")}</span>
                <Badge variant="info">
                  {t(`conversations.copilot.intents.${intentKey}`)}
                </Badge>
              </div>
            ) : (
              <p className="text-secondary">{t("conversations.copilot.noInsights")}</p>
            )}

            {copilotSummary ? (
              <p className="rounded-xl bg-surface-muted px-3 py-2.5 text-primary leading-relaxed">
                {copilotSummary}
              </p>
            ) : null}

            {error ? (
              <p className="rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger">
                {error instanceof Error ? error.message : t("conversations.copilot.error")}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void handleAnalyze()}
              disabled={isLoading}
            >
              {analyze.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {hasInsights
                ? t("conversations.copilot.regenerate")
                : t("conversations.copilot.analyze")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void handleSuggest()}
              disabled={isLoading}
            >
              {suggest.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {t("conversations.copilot.suggest")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
