"use client";

import { useT } from "@/i18n/context";
import { useFlowEvents, useFlowRuns } from "@/hooks/useFlows";

interface FlowRunsPanelProps {
  flowId: string;
  isFormFlow: boolean;
}

export function FlowRunsPanel({ flowId, isFormFlow }: FlowRunsPanelProps) {
  const t = useT();
  const { data: runs = [], isLoading: runsLoading } = useFlowRuns(flowId, isFormFlow);
  const { data: events = [], isLoading: eventsLoading } = useFlowEvents(flowId, isFormFlow);

  if (!isFormFlow) return null;

  return (
    <div className="rounded-lg border border-default bg-surface-muted/40 p-3 space-y-4">
      <div>
        <p className="text-sm font-semibold text-primary">{t("flows.history.title")}</p>
        <p className="text-xs text-secondary mt-1">{t("flows.history.subtitle")}</p>
      </div>

      <div>
        <p className="text-xs font-medium text-secondary mb-2">{t("flows.history.events")}</p>
        {eventsLoading ? (
          <div className="h-12 animate-pulse rounded bg-surface-muted" />
        ) : events.length === 0 ? (
          <p className="text-xs text-muted">{t("flows.history.emptyEvents")}</p>
        ) : (
          <div className="space-y-1.5 max-h-36 overflow-y-auto">
            {events.slice(0, 8).map((event) => (
              <div key={event.submissionId} className="rounded border border-default px-2 py-1.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono">{event.submissionId.slice(0, 8)}</span>
                  <span className="text-muted">{event.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="text-xs font-medium text-secondary mb-2">{t("flows.history.runs")}</p>
        {runsLoading ? (
          <div className="h-12 animate-pulse rounded bg-surface-muted" />
        ) : runs.length === 0 ? (
          <p className="text-xs text-muted">{t("flows.history.emptyRuns")}</p>
        ) : (
          <div className="space-y-1.5 max-h-36 overflow-y-auto">
            {runs.slice(0, 8).map((run) => (
              <div key={run.runId} className="rounded border border-default px-2 py-1.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono">{run.runId.slice(0, 8)}</span>
                  <span className="text-muted">{run.status}</span>
                </div>
                {run.errorMessage && (
                  <p className="mt-1 text-[10px] text-red-600 truncate">{run.errorMessage}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
