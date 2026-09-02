"use client";

import { useEffect } from "react";
import { X, Trash2 } from "lucide-react";
import { useT } from "@/i18n/context";
import type { FlowNode } from "@/types";
import { NodePropertiesPanel } from "./NodePropertiesPanel";
import { FLOW_NODE_META, CATEGORY_STYLES } from "./nodeConfig";

interface NodePropertiesModalProps {
  selected: FlowNode | undefined;
  flowId: string;
  hasWebhookNode?: boolean;
  isMessagingFlow?: boolean;
  botId: string;
  isVoiceFlow?: boolean;
  samplePayload?: Record<string, unknown>;
  onUpdate: (patch: Record<string, unknown>) => void;
  onDelete: () => void;
  canDelete: boolean;
  onClose: () => void;
  isSaving?: boolean;
  isDirty?: boolean;
  justSaved?: boolean;
}

export function NodePropertiesModal({
  selected,
  flowId,
  hasWebhookNode,
  isMessagingFlow,
  botId,
  isVoiceFlow,
  samplePayload,
  onUpdate,
  onDelete,
  canDelete,
  onClose,
  isSaving = false,
  isDirty = false,
  justSaved = false,
}: NodePropertiesModalProps) {
  const t = useT();

  useEffect(() => {
    if (!selected) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected, onClose]);

  if (!selected) return null;

  const meta = FLOW_NODE_META[selected.type];
  const styles = CATEGORY_STYLES[meta.category];
  const Icon = meta.icon;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
      style={{ animation: "fadeIn 0.15s ease-out" }}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-default bg-surface-elevated shadow-2xl sm:max-h-[88vh] sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="node-properties-title"
        onClick={(event) => event.stopPropagation()}
        style={{ animation: "slideUp 0.2s ease-out" }}
      >
        <div className="flex flex-shrink-0 items-center gap-4 border-b border-default bg-gradient-to-b from-surface-elevated to-surface-muted/30 px-6 py-5">
          <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${styles.bg} ${styles.border} border-2`}>
            <Icon className={`h-6 w-6 ${styles.icon}`} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="node-properties-title" className="text-lg font-semibold text-primary">
              {t(`flows.nodeTypes.${selected.type}`)}
            </h2>
            <p className="mt-0.5 text-sm text-secondary">
              {t("flows.nodePanel")}
            </p>
            {(isSaving || isDirty || justSaved) && (
              <p className="mt-1 text-xs font-medium leading-5">
                {isSaving ? (
                  <span className="text-secondary">{t("common.saving")}</span>
                ) : isDirty ? (
                  <span className="text-warning">{t("flows.unsaved")}</span>
                ) : (
                  <span className="text-success">{t("flows.nodeSaved")}</span>
                )}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-default bg-surface-elevated text-secondary transition-all hover:border-accent hover:bg-surface-muted hover:text-primary"
            aria-label={t("common.close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <NodePropertiesPanel
            selected={selected}
            flowId={flowId}
            hasWebhookNode={hasWebhookNode}
            isMessagingFlow={isMessagingFlow}
            botId={botId}
            isVoiceFlow={isVoiceFlow}
            samplePayload={samplePayload}
            onUpdate={onUpdate}
            onDelete={onDelete}
            canDelete={canDelete}
            hideHeader
          />
        </div>

        {canDelete && (
          <div className="flex flex-shrink-0 items-center justify-end border-t border-default bg-surface-muted/40 px-6 py-4">
            <button
              type="button"
              onClick={onDelete}
              className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/5 px-4 py-2 text-sm font-medium text-danger transition-all hover:border-danger hover:bg-danger/10"
            >
              <Trash2 className="h-4 w-4" />
              {t("flows.deleteNode")}
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { 
            opacity: 0;
            transform: translateY(20px) scale(0.98);
          }
          to { 
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}
