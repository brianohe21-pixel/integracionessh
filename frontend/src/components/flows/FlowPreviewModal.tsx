"use client";

import { X } from "lucide-react";
import { useMemo } from "react";
import { useLocale, useT } from "@/i18n/context";
import { useBots } from "@/hooks/useBots";
import type { FlowEdge, FlowNode, FlowNodeType } from "@/types";
import { buildFlowPreviewSteps } from "@/lib/flow-preview";
import { CATEGORY_STYLES, FLOW_NODE_META } from "./nodeConfig";
import { Button } from "@/components/ui/Button";

interface FlowPreviewModalProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  getTypeLabel: (type: FlowNodeType) => string;
  onClose: () => void;
}

export function FlowPreviewModal({
  nodes,
  edges,
  getTypeLabel,
  onClose,
}: FlowPreviewModalProps) {
  const t = useT();
  const locale = useLocale();
  const { data: bots } = useBots();

  const botNames = useMemo(
    () => Object.fromEntries((bots ?? []).map((bot) => [bot.botId, bot.name])),
    [bots]
  );

  const steps = useMemo(
    () =>
      buildFlowPreviewSteps({
        nodes,
        edges,
        locale,
        getTypeLabel,
        botNames,
        branchTrue: t("flows.fields.branchTrue"),
        branchFalse: t("flows.fields.branchFalse"),
      }),
    [nodes, edges, locale, getTypeLabel, botNames, t]
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-default bg-surface-elevated shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-default px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-primary">{t("flows.previewModal.title")}</h2>
            <p className="mt-0.5 text-xs text-secondary">{t("flows.previewModal.subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-muted hover:text-secondary"
            aria-label={t("flows.previewModal.close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {steps.length === 0 ? (
            <p className="text-sm text-secondary">{t("flows.previewModal.empty")}</p>
          ) : (
            <ol className="space-y-3">
              {steps.map((step, index) => {
                const meta = FLOW_NODE_META[step.type];
                const styles = CATEGORY_STYLES[meta.category];
                const Icon = meta.icon;
                return (
                  <li key={`${step.nodeId}-${index}`} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${styles.border} ${styles.bg}`}
                      >
                        <Icon className={`h-4 w-4 ${styles.icon}`} />
                      </span>
                      {index < steps.length - 1 ? (
                        <span className="mt-1 w-px flex-1 bg-default" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1 pb-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-primary">{step.title}</p>
                        {step.branchLabel ? (
                          <span className="rounded bg-surface-muted px-2 py-0.5 text-[10px] font-medium text-secondary">
                            {step.branchLabel}
                          </span>
                        ) : null}
                      </div>
                      {step.detail ? (
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-secondary">
                          {step.detail}
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <div className="border-t border-default px-5 py-4">
          <Button type="button" variant="secondary" className="w-full" onClick={onClose}>
            {t("flows.previewModal.close")}
          </Button>
        </div>
      </div>
    </div>
  );
}
