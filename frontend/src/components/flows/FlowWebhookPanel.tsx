"use client";

import { useState } from "react";
import { Copy, RefreshCw } from "lucide-react";
import { useT } from "@/i18n/context";
import { useFlowHook, useRotateFlowHook } from "@/hooks/useFlows";
import { Button } from "@/components/ui/Button";
import { FlowWebhookGuide } from "./FlowWebhookGuide";

interface FlowWebhookPanelProps {
  flowId: string;
  samplePayload?: Record<string, unknown>;
  showGuide?: boolean;
}

export function FlowWebhookPanel({
  flowId,
  samplePayload,
  showGuide = true,
}: FlowWebhookPanelProps) {
  const t = useT();
  const { data, refetch, isLoading } = useFlowHook(flowId);
  const rotate = useRotateFlowHook(flowId);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);

  async function handleRotate() {
    const result = await rotate.mutateAsync();
    setRevealedSecret(result.secret ?? null);
    await refetch();
  }

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text);
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-default bg-surface-muted/40 p-3 space-y-3">
        <div>
          <p className="text-sm font-semibold text-primary">{t("flows.webhook.title")}</p>
          <p className="text-xs text-secondary mt-1">{t("flows.webhook.subtitle")}</p>
        </div>

        {isLoading ? (
          <div className="h-16 animate-pulse rounded bg-surface-muted" />
        ) : data?.configured ? (
          <div className="space-y-2">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted">{t("flows.webhook.url")}</p>
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-surface-elevated px-2 py-1 text-xs">
                  {data.webhookUrl}
                </code>
                <button
                  type="button"
                  onClick={() => void copyText(data.webhookUrl ?? "")}
                  className="rounded border border-default p-1.5 text-secondary hover:text-primary"
                  aria-label={t("flows.webhook.copy")}
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            {revealedSecret && (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted">{t("flows.webhook.secret")}</p>
                <div className="mt-1 flex items-center gap-2">
                  <code className="flex-1 truncate rounded bg-warning/10 px-2 py-1 text-xs text-warning">
                    {revealedSecret}
                  </code>
                  <button
                    type="button"
                    onClick={() => void copyText(revealedSecret)}
                    className="rounded border border-default p-1.5 text-secondary hover:text-primary"
                    aria-label={t("flows.webhook.copy")}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-warning">{t("flows.webhook.secretOnceHint")}</p>
              </div>
            )}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void handleRotate()}
              disabled={rotate.isPending}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              {t("flows.webhook.rotate")}
            </Button>
          </div>
        ) : (
          <p className="text-xs text-secondary">{t("flows.webhook.notConfigured")}</p>
        )}
      </div>

      {showGuide ? (
        <FlowWebhookGuide
          webhookUrl={data?.webhookUrl}
          secret={revealedSecret}
          samplePayload={samplePayload}
        />
      ) : null}
    </div>
  );
}
