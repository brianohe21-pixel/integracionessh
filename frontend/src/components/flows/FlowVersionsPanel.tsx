"use client";

import { useT } from "@/i18n/context";
import { useFormatters } from "@/hooks/useFormatters";
import { useFlowVersions, useRestoreFlowVersion } from "@/hooks/useFlows";

import type { FlowDefinition } from "@/types";

interface FlowVersionsPanelProps {
  flowId: string;
  onRestored?: (flow: FlowDefinition) => void;
}

export function FlowVersionsPanel({ flowId, onRestored }: FlowVersionsPanelProps) {
  const t = useT();
  const { formatDate } = useFormatters();
  const { data: versions = [], isLoading } = useFlowVersions(flowId);
  const restore = useRestoreFlowVersion(flowId);

  return (
    <div className="rounded-lg border border-default bg-surface-muted/40 p-3 space-y-3">
      <div>
        <p className="text-sm font-semibold text-primary">{t("flows.versions.title")}</p>
        <p className="text-xs text-secondary mt-1">{t("flows.versions.subtitle")}</p>
      </div>

      {isLoading ? (
        <div className="h-12 animate-pulse rounded bg-surface-muted" />
      ) : versions.length === 0 ? (
        <p className="text-xs text-muted">{t("flows.versions.empty")}</p>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {versions.map((version) => (
            <div
              key={version.version}
              className="rounded border border-default px-2 py-1.5 text-xs space-y-1"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-primary">
                  {t("flows.versionLabel", { version: version.version })}
                </span>
                <span className="text-muted">{formatDate(version.publishedAt)}</span>
              </div>
              <button
                type="button"
                disabled={restore.isPending}
                onClick={() =>
                  restore.mutate(version.version, {
                    onSuccess: (updated) => onRestored?.(updated),
                  })
                }
                className="text-[10px] font-medium text-accent hover:underline disabled:opacity-50"
              >
                {restore.isPending ? t("flows.versions.restoring") : t("flows.versions.restore")}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
