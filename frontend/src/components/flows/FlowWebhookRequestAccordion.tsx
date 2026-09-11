"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Copy } from "lucide-react";
import { useT } from "@/i18n/context";
import { cn } from "@/lib/utils";
import type { FlowEventRequestSnapshot, FlowEventSubmission } from "@/types";

interface FlowWebhookRequestAccordionProps {
  event?: FlowEventSubmission | null;
  webhookUrl?: string;
  hookKey?: string;
  idempotencyKey?: string;
}

type AccordionSection = "overview" | "headers" | "body" | "full";

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function buildRequestSnapshot(
  event?: FlowEventSubmission | null,
  webhookUrl?: string,
  hookKey?: string,
  idempotencyKey?: string
): FlowEventRequestSnapshot {
  if (event?.request) return event.request;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Flow-Secret": "[redacted]",
  };
  const resolvedIdempotencyKey = event?.idempotencyKey ?? idempotencyKey;
  if (resolvedIdempotencyKey) {
    headers["Idempotency-Key"] = resolvedIdempotencyKey;
  }

  let path = `/public/flow-hooks/${event?.hookKey ?? hookKey ?? ""}`;
  if (webhookUrl) {
    try {
      path = `${new URL(webhookUrl).pathname}${new URL(webhookUrl).search}`;
    } catch {
      path = webhookUrl;
    }
  }

  const bodyRaw = event?.payload ? formatJson(event.payload) : undefined;

  return {
    method: "POST",
    path,
    headers,
    bodyRaw,
  };
}

function RequestSection({
  id,
  title,
  open,
  onToggle,
  children,
}: {
  id: AccordionSection;
  title: string;
  open: boolean;
  onToggle: (id: AccordionSection) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-default bg-surface-elevated">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-medium text-primary">{title}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-secondary transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open ? <div className="border-t border-default px-3 py-3">{children}</div> : null}
    </div>
  );
}

function CodeBlock({ value, onCopy }: { value: string; onCopy?: () => void }) {
  const t = useT();

  return (
    <div className="relative">
      {onCopy ? (
        <button
          type="button"
          onClick={onCopy}
          className="absolute right-2 top-2 rounded border border-default bg-surface-elevated p-1.5 text-secondary hover:text-primary"
          aria-label={t("flows.webhook.copy")}
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      ) : null}
      <pre className="max-h-72 overflow-auto rounded-lg border border-default bg-surface-muted p-3 pr-10 text-xs whitespace-pre-wrap break-all">
        {value}
      </pre>
    </div>
  );
}

export function FlowWebhookRequestAccordion({
  event,
  webhookUrl,
  hookKey,
  idempotencyKey,
}: FlowWebhookRequestAccordionProps) {
  const t = useT();
  const [openSection, setOpenSection] = useState<AccordionSection | null>("overview");

  const request = useMemo(
    () => buildRequestSnapshot(event, webhookUrl, hookKey, idempotencyKey),
    [event, webhookUrl, hookKey, idempotencyKey]
  );

  const fullRequest = useMemo(
    () =>
      formatJson({
        method: request.method,
        path: request.path,
        url: webhookUrl ?? request.path,
        headers: request.headers,
        queryString: request.queryString,
        body: request.bodyRaw,
        sourceIp: request.sourceIp,
        userAgent: request.userAgent,
      }),
    [request, webhookUrl]
  );

  function toggleSection(section: AccordionSection) {
    setOpenSection((current) => (current === section ? null : section));
  }

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
  }

  const headerJson = formatJson(request.headers);
  const bodyValue =
    request.bodyRaw?.trim() ||
    (event?.payload ? formatJson(event.payload) : t("flows.activity.webhookNoPayload"));

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-primary">{t("flows.activity.webhookRequestTitle")}</p>

      <RequestSection
        id="overview"
        title={t("flows.activity.webhookRequestOverview")}
        open={openSection === "overview"}
        onToggle={toggleSection}
      >
        <dl className="space-y-2 text-xs">
          <div>
            <dt className="text-muted">{t("flows.activity.webhookRequestMethod")}</dt>
            <dd className="mt-0.5 font-mono text-primary">{request.method}</dd>
          </div>
          <div>
            <dt className="text-muted">{t("flows.activity.webhookUrl")}</dt>
            <dd className="mt-0.5 break-all font-mono text-primary">
              {webhookUrl ?? request.path}
            </dd>
          </div>
          {request.sourceIp ? (
            <div>
              <dt className="text-muted">{t("flows.activity.webhookRequestSourceIp")}</dt>
              <dd className="mt-0.5 font-mono text-primary">{request.sourceIp}</dd>
            </div>
          ) : null}
          {request.userAgent ? (
            <div>
              <dt className="text-muted">{t("flows.activity.webhookRequestUserAgent")}</dt>
              <dd className="mt-0.5 break-all text-primary">{request.userAgent}</dd>
            </div>
          ) : null}
          {request.queryString && Object.keys(request.queryString).length > 0 ? (
            <div>
              <dt className="text-muted">{t("flows.activity.webhookRequestQuery")}</dt>
              <dd className="mt-0.5">
                <CodeBlock value={formatJson(request.queryString)} onCopy={() => void copy(formatJson(request.queryString!))} />
              </dd>
            </div>
          ) : null}
        </dl>
      </RequestSection>

      <RequestSection
        id="headers"
        title={t("flows.activity.webhookRequestHeaders")}
        open={openSection === "headers"}
        onToggle={toggleSection}
      >
        <CodeBlock value={headerJson} onCopy={() => void copy(headerJson)} />
      </RequestSection>

      <RequestSection
        id="body"
        title={t("flows.activity.webhookRequestBody")}
        open={openSection === "body"}
        onToggle={toggleSection}
      >
        <CodeBlock value={bodyValue} onCopy={() => void copy(bodyValue)} />
      </RequestSection>

      <RequestSection
        id="full"
        title={t("flows.activity.webhookRequestFull")}
        open={openSection === "full"}
        onToggle={toggleSection}
      >
        <CodeBlock value={fullRequest} onCopy={() => void copy(fullRequest)} />
      </RequestSection>
    </div>
  );
}
