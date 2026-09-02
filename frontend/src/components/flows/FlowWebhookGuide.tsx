"use client";

import { useT } from "@/i18n/context";
import {
  FLOW_WEBHOOK_HEADERS,
  FLOW_WEBHOOK_RESPONSE_EXAMPLE,
  buildFlowWebhookCurlExample,
  buildFlowWebhookCurlPlaceholder,
  buildFlowWebhookPayloadExample,
} from "@/lib/flow-webhook-contract";
import { cn } from "@/lib/utils";

interface FlowWebhookGuideProps {
  webhookUrl?: string;
  secret?: string;
  samplePayload?: Record<string, unknown>;
  className?: string;
  hideTitle?: boolean;
}

const GUIDE_STEP_KEYS = [
  "flows.webhook.guide.steps.0",
  "flows.webhook.guide.steps.1",
  "flows.webhook.guide.steps.2",
  "flows.webhook.guide.steps.3",
  "flows.webhook.guide.steps.4",
  "flows.webhook.guide.steps.5",
] as const;

export function FlowWebhookGuide({
  webhookUrl,
  secret,
  samplePayload,
  className,
  hideTitle = false,
}: FlowWebhookGuideProps) {
  const t = useT();
  const payloadExample = buildFlowWebhookPayloadExample(samplePayload);
  const curlExample =
    webhookUrl && secret
      ? buildFlowWebhookCurlExample(webhookUrl, secret, payloadExample)
      : buildFlowWebhookCurlPlaceholder(payloadExample);

  return (
    <div
      className={cn(
        "rounded-lg border border-default bg-surface-elevated p-3 space-y-3",
        className
      )}
    >
      {!hideTitle ? (
        <div>
          <p className="text-sm font-semibold text-primary">{t("flows.webhook.guide.title")}</p>
          <p className="mt-1 text-xs text-secondary">{t("flows.webhook.guide.subtitle")}</p>
        </div>
      ) : null}

      <ol className="space-y-2 text-xs text-secondary">
        {GUIDE_STEP_KEYS.map((key, index) => (
          <li key={key} className="flex gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-muted text-[10px] font-semibold text-accent">
              {index + 1}
            </span>
            <span className="leading-relaxed">{t(key)}</span>
          </li>
        ))}
      </ol>

      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
          {t("flows.webhook.guide.headers")}
        </p>
        <pre className="overflow-x-auto rounded-lg border border-default bg-surface-muted/50 p-2 text-[11px] text-primary">
          {FLOW_WEBHOOK_HEADERS.join("\n")}
        </pre>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
          {t("flows.webhook.guide.requestExample")}
        </p>
        <pre className="overflow-x-auto rounded-lg border border-default bg-surface-muted/50 p-2 text-[11px] text-primary whitespace-pre-wrap break-all">
          {curlExample}
        </pre>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
          {t("flows.webhook.guide.responseExample")}
        </p>
        <pre className="overflow-x-auto rounded-lg border border-default bg-surface-muted/50 p-2 text-[11px] text-primary">
          {JSON.stringify(FLOW_WEBHOOK_RESPONSE_EXAMPLE, null, 2)}
        </pre>
      </div>

      <p className="text-xs text-secondary">{t("flows.webhook.guide.bindingsHint")}</p>
      <p className="text-xs text-muted">{t("flows.webhook.guide.idempotencyHint")}</p>
    </div>
  );
}
