"use client";

import { X } from "lucide-react";
import { useT } from "@/i18n/context";
import { useFormatters } from "@/hooks/useFormatters";
import { useFlowEvents, useFlowHook, useFlowRunDetail } from "@/hooks/useFlows";
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

export function FlowActivityDetailModal({
  flowId,
  item,
  nodes,
  onClose,
}: FlowActivityDetailModalProps) {
  const t = useT();
  const { formatDate } = useFormatters();
  const isWebhookItem = item?.kind === "event";
  const runId = item?.kind === "run" ? item.runId ?? item.activityId : item?.runId ?? null;
  const { data: run, isLoading } = useFlowRunDetail(runId);
  const { data: events, isLoading: eventsLoading } = useFlowEvents(flowId, isWebhookItem);
  const { data: hookData } = useFlowHook(flowId, isWebhookItem);
  const event =
    events?.find((entry) => entry.submissionId === item?.submissionId) ?? null;

  if (!item) return null;

  const nodeLabel = (nodeId: string) => {
    const node = nodes.find((entry) => entry.id === nodeId);
    if (!node) return nodeId;
    const typeLabel = t(`flows.nodeTypes.${node.type}`);
    return node.data.label ? `${node.data.label} (${typeLabel})` : typeLabel;
  };

  return (
    <Modal>
      <div className="mx-4 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-default bg-surface-elevated shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-default px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-primary">{t("flows.activity.detailTitle")}</h2>
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
            eventsLoading ? (
              <div className="h-28 animate-pulse rounded-lg bg-surface-muted" />
            ) : (
              <FlowWebhookRequestAccordion
                event={event}
                webhookUrl={hookData?.webhookUrl}
                hookKey={event?.hookKey ?? hookData?.hookKey}
                idempotencyKey={event?.idempotencyKey}
              />
            )
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
              {isLoading ? (
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
