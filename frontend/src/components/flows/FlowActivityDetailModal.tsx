"use client";

import { Copy, X } from "lucide-react";
import { useT } from "@/i18n/context";
import { useFormatters } from "@/hooks/useFormatters";
import { useFlowEventDetail, useFlowRunDetail } from "@/hooks/useFlows";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FlowWebhookRequestAccordion } from "@/components/flows/FlowWebhookRequestAccordion";
import type { FlowActivitySummary, FlowNode } from "@/types";

interface FlowActivityDetailModalProps {
  flowId: string;
  item: FlowActivitySummary | null;
  nodes: FlowNode[];
  onClose: () => void;
}

function statusVariant(
  status: string
): "success" | "warning" | "danger" | "info" | "default" {
  if (status === "completed") return "success";
  if (status === "failed") return "danger";
  if (status === "active" || status === "waiting" || status === "processing") return "warning";
  if (status === "accepted") return "info";
  return "default";
}

function CopyableField({ label, value }: { label: string; value: string }) {
  const t = useT();

  async function copy() {
    await navigator.clipboard.writeText(value);
  }

  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <div className="mt-1 flex items-start gap-2">
        <code className="flex-1 break-all rounded bg-surface-muted px-2 py-1 text-xs text-primary">
          {value}
        </code>
        <button
          type="button"
          onClick={() => void copy()}
          className="shrink-0 rounded border border-default p-1.5 text-secondary hover:text-primary"
          aria-label={t("flows.webhook.copy")}
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function FlowActivityDetailModal({
  flowId,
  item,
  nodes,
  onClose,
}: FlowActivityDetailModalProps) {
  const t = useT();
  const { formatDate } = useFormatters();
  const runId = item?.kind === "run" ? item.runId ?? item.activityId : item?.runId ?? null;
  const submissionId = item?.submissionId ?? null;
  const isWebhookItem =
    item?.kind === "event" || item?.source === "webhook" || item?.source === "event";
  const { data: run, isLoading: runLoading } = useFlowRunDetail(runId);
  const { data: event, isLoading: eventLoading } = useFlowEventDetail(
    flowId,
    submissionId,
    isWebhookItem && !!submissionId
  );

  if (!item) return null;

  const nodeLabel = (nodeId: string) => {
    const node = nodes.find((entry) => entry.id === nodeId);
    if (!node) return nodeId;
    const typeLabel = t(`flows.nodeTypes.${node.type}`);
    return node.data.label ? `${node.data.label} (${typeLabel})` : typeLabel;
  };

  const payloadSource =
    event?.payload ??
    (run?.formPayload && Object.keys(run.formPayload).length > 0 ? run.formPayload : null);
  const payloadJson = payloadSource ? JSON.stringify(payloadSource, null, 2) : "";
  const payloadBytes = payloadJson ? new TextEncoder().encode(payloadJson).length : 0;
  const linkedRunId = event?.runId ?? runId;

  return (
    <Modal>
      <div className="mx-4 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-default bg-surface-elevated shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-default px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-primary">
              {isWebhookItem ? t("flows.activity.webhookDetailTitle") : t("flows.activity.detailTitle")}
            </h2>
            <p className="mt-1 text-xs text-secondary">{formatDate(item.createdAt)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-surface-muted hover:text-primary"
            aria-label={t("flows.previewModal.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant(item.status)} dot>
              {t(`flows.activity.status.${item.status}`)}
            </Badge>
            <Badge variant="default">
              {t(`flows.activity.source.${item.source ?? "conversation"}`)}
            </Badge>
            {item.kind === "event" ? (
              <Badge variant="info">{t("flows.activity.kindEvent")}</Badge>
            ) : null}
          </div>

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            {item.runId ? (
              <div>
                <dt className="text-xs text-secondary">{t("flows.activity.colRunId")}</dt>
                <dd className="mt-0.5 font-mono text-xs break-all">{item.runId}</dd>
              </div>
            ) : null}
            {item.submissionId ? (
              <div>
                <dt className="text-xs text-secondary">{t("flows.activity.colSubmissionId")}</dt>
                <dd className="mt-0.5 font-mono text-xs break-all">{item.submissionId}</dd>
              </div>
            ) : null}
            {item.customerPhone ? (
              <div>
                <dt className="text-xs text-secondary">{t("flows.activity.colContact")}</dt>
                <dd className="mt-0.5">{item.customerPhone}</dd>
              </div>
            ) : null}
            {item.conversationId ? (
              <div>
                <dt className="text-xs text-secondary">{t("flows.activity.colConversation")}</dt>
                <dd className="mt-0.5 font-mono text-xs break-all">{item.conversationId}</dd>
              </div>
            ) : null}
            {typeof item.stepCount === "number" ? (
              <div>
                <dt className="text-xs text-secondary">{t("flows.activity.colSteps")}</dt>
                <dd className="mt-0.5">{item.stepCount}</dd>
              </div>
            ) : null}
          </dl>

          {item.errorMessage ? (
            <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {item.errorMessage}
            </div>
          ) : null}

          {isWebhookItem ? (
            <div className="space-y-3 rounded-lg border border-default bg-surface-muted/40 p-4">
              <p className="text-sm font-semibold text-primary">{t("flows.activity.webhookTechnical")}</p>

              {eventLoading ? (
                <div className="h-28 animate-pulse rounded-lg bg-surface-muted" />
              ) : (
                <div className="space-y-3">
                  {event?.webhookUrl ? (
                    <CopyableField label={t("flows.activity.webhookUrl")} value={event.webhookUrl} />
                  ) : null}
                  {(event?.hookKey ?? item.hookKey) ? (
                    <CopyableField
                      label={t("flows.activity.webhookHookKey")}
                      value={event?.hookKey ?? item.hookKey ?? ""}
                    />
                  ) : null}
                  {(event?.idempotencyKey ?? item.idempotencyKey) ? (
                    <CopyableField
                      label={t("flows.activity.webhookIdempotencyKey")}
                      value={event?.idempotencyKey ?? item.idempotencyKey ?? ""}
                    />
                  ) : null}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted">
                        {t("flows.activity.webhookReceivedAt")}
                      </p>
                      <p className="mt-1 text-xs text-primary">
                        {formatDate(event?.createdAt ?? item.createdAt)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted">
                        {t("flows.activity.webhookUpdatedAt")}
                      </p>
                      <p className="mt-1 text-xs text-primary">
                        {formatDate(event?.updatedAt ?? item.updatedAt)}
                      </p>
                    </div>
                  </div>

                  {linkedRunId ? (
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted">
                        {t("flows.activity.webhookLinkedRun")}
                      </p>
                      <p className="mt-1 font-mono text-xs break-all text-primary">{linkedRunId}</p>
                    </div>
                  ) : null}

                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted">
                      {t("flows.activity.webhookExpectedHeaders")}
                    </p>
                    <ul className="mt-1 space-y-1 text-xs text-secondary">
                      <li>
                        <code>{t("flows.activity.webhookHeaderSecret")}</code>
                      </li>
                      <li>
                        <code>{t("flows.activity.webhookHeaderIdempotency")}</code>
                      </li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {isWebhookItem && !eventLoading ? (
            <FlowWebhookRequestAccordion
              event={event}
              webhookUrl={event?.webhookUrl}
              hookKey={event?.hookKey ?? item.hookKey}
              idempotencyKey={event?.idempotencyKey ?? item.idempotencyKey}
            />
          ) : null}

          {payloadJson ? (
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-secondary">{t("flows.activity.webhookPayload")}</p>
                <span className="text-[11px] text-muted">
                  {t("flows.activity.webhookPayloadSize", { bytes: payloadBytes })}
                </span>
              </div>
              <pre className="max-h-72 overflow-auto rounded-lg border border-default bg-surface-muted p-3 text-xs whitespace-pre-wrap break-all">
                {payloadJson}
              </pre>
            </div>
          ) : isWebhookItem && !eventLoading ? (
            <p className="text-sm text-muted">{t("flows.activity.webhookNoPayload")}</p>
          ) : item.payloadPreview ? (
            <div>
              <p className="mb-1 text-xs font-medium text-secondary">{t("flows.activity.colPayload")}</p>
              <pre className="max-h-40 overflow-auto rounded-lg border border-default bg-surface-muted p-3 text-xs whitespace-pre-wrap break-all">
                {item.payloadPreview}
              </pre>
            </div>
          ) : null}

          {item.kind === "run" ? (
            <div>
              <p className="mb-2 text-xs font-medium text-secondary">
                {t("flows.activity.stepTimeline")}
              </p>
              {runLoading ? (
                <div className="h-24 animate-pulse rounded-lg bg-surface-muted" />
              ) : !run?.stepHistory?.length ? (
                <p className="text-sm text-muted">{t("flows.activity.noSteps")}</p>
              ) : (
                <ol className="space-y-2">
                  {run.stepHistory.map((step, index) => (
                    <li
                      key={`${step.nodeId}-${step.at}-${index}`}
                      className="rounded-lg border border-default px-3 py-2 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-primary">{nodeLabel(step.nodeId)}</span>
                        <span className="text-muted">{formatDate(step.at)}</span>
                      </div>
                      {step.output ? (
                        <p className="mt-1 text-secondary break-all">{step.output}</p>
                      ) : null}
                      {step.error ? (
                        <p className="mt-1 text-danger break-all">{step.error}</p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ) : null}
        </div>

        <div className="border-t border-default px-5 py-3">
          <Button variant="secondary" onClick={onClose}>
            {t("flows.previewModal.close")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
