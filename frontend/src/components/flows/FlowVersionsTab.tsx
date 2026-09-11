"use client";

import { GitBranch } from "lucide-react";
import { useT } from "@/i18n/context";
import { useFormatters } from "@/hooks/useFormatters";
import { useFlowVersions, useRestoreFlowVersion } from "@/hooks/useFlows";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { TableContainer } from "@/components/ui/TableContainer";
import type { FlowDefinition } from "@/types";

interface FlowVersionsTabProps {
  flowId: string;
  onRestored?: (flow: FlowDefinition) => void;
}

export function FlowVersionsTab({ flowId, onRestored }: FlowVersionsTabProps) {
  const t = useT();
  const { formatDate } = useFormatters();
  const { data, isLoading } = useFlowVersions(flowId);
  const versions = Array.isArray(data) ? data : [];
  const restore = useRestoreFlowVersion(flowId);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-canvas">
      <div className="border-b border-default bg-surface-elevated px-4 py-4">
        <h2 className="text-sm font-semibold text-primary">{t("flows.versions.title")}</h2>
        <p className="mt-1 text-xs text-secondary">{t("flows.versions.subtitle")}</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 scrollbar-hidden">
        {isLoading ? (
          <SkeletonTable rows={6} cols={3} />
        ) : versions.length === 0 ? (
          <EmptyState
            icon={<GitBranch className="h-6 w-6" />}
            title={t("flows.versions.empty")}
            description={t("flows.versions.emptyHint")}
          />
        ) : (
          <TableContainer>
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="bg-surface text-left text-xs uppercase tracking-wide text-secondary">
                  <th className="px-4 py-3">{t("flows.versions.colVersion")}</th>
                  <th className="px-4 py-3">{t("flows.versions.colPublishedAt")}</th>
                  <th className="px-4 py-3 text-right">{t("flows.colActions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {versions.map((version) => (
                  <tr key={version.version} className="align-middle">
                    <td className="px-4 py-3 font-semibold text-primary">
                      {t("flows.versionLabel", { version: version.version })}
                    </td>
                    <td className="px-4 py-3 text-secondary">{formatDate(version.publishedAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={restore.isPending}
                        onClick={() =>
                          restore.mutate(version.version, {
                            onSuccess: (updated) => onRestored?.(updated),
                          })
                        }
                      >
                        {restore.isPending
                          ? t("flows.versions.restoring")
                          : t("flows.versions.restore")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableContainer>
        )}
      </div>
    </div>
  );
}
