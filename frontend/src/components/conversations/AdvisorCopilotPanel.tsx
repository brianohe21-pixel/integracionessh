"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useCopilotAnalyze, useCopilotSuggest } from "@/hooks/useCopilot";
import { useT } from "@/i18n/context";
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

  if (tenant?.plan === "free") {
    return null;
  }

  const detectedIntent = conversation.detectedIntent;
  const copilotSummary = conversation.copilotSummary;
  const isLoading = analyze.isPending || suggest.isPending;
  const error = analyze.error ?? suggest.error;

  async function handleAnalyze() {
    await analyze.mutateAsync({
      conversationId: conversation.conversationId,
      botId: conversation.botId,
    });
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

  const intentKey = detectedIntent ? intentLabelKey(detectedIntent) : null;

  return (
    <div className="border-t border-default bg-surface-muted/50 px-4 py-3">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-accent" />
        <span className="text-sm font-medium text-primary">{t("conversations.copilot.title")}</span>
      </div>

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

        {copilotSummary && (
          <p className="text-primary leading-relaxed">{copilotSummary}</p>
        )}

        {error && (
          <p className="text-danger text-xs">
            {error instanceof Error ? error.message : t("conversations.copilot.error")}
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void handleAnalyze()}
          disabled={isLoading}
        >
          {analyze.isPending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          )}
          {t("conversations.copilot.regenerate")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => void handleSuggest()}
          disabled={isLoading}
        >
          {suggest.isPending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
          )}
          {t("conversations.copilot.suggest")}
        </Button>
      </div>
    </div>
  );
}
