"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, History, Search } from "lucide-react";
import { useT } from "@/i18n/context";
import { useFormatters } from "@/hooks/useFormatters";
import { useFlowActivity, useSeedFlowActivity, type FlowActivityFilters } from "@/hooks/useFlows";
import { isDevelopEnvironment } from "@/lib/demo-access";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { TableContainer } from "@/components/ui/TableContainer";
import { FlowActivityDetailModal } from "@/components/flows/FlowActivityDetailModal";
import type { FlowActivitySummary, FlowNode } from "@/types";

interface FlowActivityTabProps {
  flowId: string;
  nodes: FlowNode[];
}

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

function statusVariant(
  status: string
): "success" | "warning" | "danger" | "info" | "default" {
  if (status === "completed") return "success";
  if (status === "failed") return "danger";
  if (status === "active" || status === "waiting" || status === "processing") return "warning";
  if (status === "accepted") return "info";
  return "default";
}

export function FlowActivityTab({ flowId, nodes }: FlowActivityTabProps) {
  const t = useT();
  const { formatDate } = useFormatters();
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState<FlowActivityFilters["source"]>("all");
  const [pageSize, setPageSize] = useState<number>(20);
  const [cursorStack, setCursorStack] = useState<Array<string | undefined>>([undefined]);
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedItem, setSelectedItem] = useState<FlowActivitySummary | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setCursorStack([undefined]);
    setPageIndex(0);
  }, [debouncedSearch, status, source, pageSize]);

  const filters: FlowActivityFilters = {
    status,
    source,
    q: debouncedSearch,
    limit: pageSize,
    cursor: cursorStack[pageIndex],
  };

  const { data, isLoading, isFetching } = useFlowActivity(flowId, filters);
  const seedActivity = useSeedFlowActivity(flowId);
  const showDevSeed = isDevelopEnvironment();
  const items = data?.items ?? [];
  const nextCursor = data?.nextCursor;
  const canGoPrev = pageIndex > 0;
  const canGoNext = Boolean(nextCursor);

  function goNextPage() {
    if (!nextCursor) return;
    setCursorStack((current) => {
      const next = [...current];
      next[pageIndex + 1] = nextCursor;
      return next.slice(0, pageIndex + 2);
    });
    setPageIndex((current) => current + 1);
  }

  function goPrevPage() {
    if (pageIndex <= 0) return;
    setPageIndex((current) => current - 1);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-canvas">
      <div className="border-b border-default bg-surface-elevated px-4 py-4 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-primary">{t("flows.activity.title")}</h2>
            <p className="mt-1 text-xs text-secondary">{t("flows.activity.subtitle")}</p>
          </div>
          {showDevSeed ? (
            <Button
              variant="secondary"
              size="sm"
              disabled={seedActivity.isPending}
              onClick={() => seedActivity.mutate()}
            >
              {seedActivity.isPending
                ? t("flows.activity.seedLoading")
                : t("flows.activity.seedSample")}
            </Button>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="relative w-full xl:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={t("flows.activity.searchPlaceholder")}
              className="w-full rounded-lg border border-default bg-surface-elevated py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="rounded-lg border border-default bg-surface-elevated px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="all">{t("flows.activity.filterStatusAll")}</option>
              <option value="completed">{t("flows.activity.status.completed")}</option>
              <option value="failed">{t("flows.activity.status.failed")}</option>
              <option value="active">{t("flows.activity.status.active")}</option>
              <option value="waiting">{t("flows.activity.status.waiting")}</option>
              <option value="accepted">{t("flows.activity.status.accepted")}</option>
              <option value="processing">{t("flows.activity.status.processing")}</option>
            </select>

            <select
              value={source}
              onChange={(event) =>
                setSource(event.target.value as FlowActivityFilters["source"])
              }
              className="rounded-lg border border-default bg-surface-elevated px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="all">{t("flows.activity.filterSourceAll")}</option>
              <option value="conversation">{t("flows.activity.source.conversation")}</option>
              <option value="event">{t("flows.activity.source.event")}</option>
            </select>

            <select
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value))}
              className="rounded-lg border border-default bg-surface-elevated px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {t("flows.activity.pageSize", { size })}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {isLoading ? (
          <SkeletonTable rows={6} cols={6} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<History className="h-6 w-6" />}
            title={t("flows.activity.empty")}
            description={t("flows.activity.emptyHint")}
            action={
              showDevSeed ? (
                <Button
                  variant="secondary"
                  disabled={seedActivity.isPending}
                  onClick={() => seedActivity.mutate()}
                >
                  {seedActivity.isPending
                    ? t("flows.activity.seedLoading")
                    : t("flows.activity.seedSample")}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <TableContainer>
              <table className="w-full min-w-[1080px] text-sm">
                <thead>
                  <tr className="bg-surface text-left text-xs uppercase tracking-wide text-secondary">
                    <th className="px-4 py-3">{t("flows.activity.colWhen")}</th>
                    <th className="px-4 py-3">{t("flows.activity.colSource")}</th>
                    <th className="px-4 py-3">{t("common.status")}</th>
                    <th className="px-4 py-3">{t("flows.activity.colContact")}</th>
                    <th className="px-4 py-3">{t("flows.activity.colSteps")}</th>
                    <th className="px-4 py-3">{t("flows.activity.colWebhook")}</th>
                    <th className="px-4 py-3">{t("flows.activity.colPayload")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-default">
                  {items.map((item) => (
                    <tr
                      key={`${item.kind}-${item.activityId}`}
                      className="cursor-pointer align-top transition-colors hover:bg-surface-muted/70"
                      onClick={() => setSelectedItem(item)}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">{formatDate(item.createdAt)}</td>
                      <td className="px-4 py-3">
                        <Badge variant="default">
                          {t(`flows.activity.source.${item.source ?? "conversation"}`)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant(item.status)} dot>
                          {t(`flows.activity.status.${item.status}`)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-secondary">
                        {item.customerPhone ??
                          (item.conversationId
                            ? item.conversationId.slice(0, 8)
                            : item.submissionId?.slice(0, 8) ?? "—")}
                      </td>
                      <td className="px-4 py-3 text-secondary">
                        {typeof item.stepCount === "number" ? item.stepCount : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {item.kind === "event" || item.source === "webhook" ? (
                          <div className="space-y-1">
                            {item.hookKey ? (
                              <code className="block max-w-[10rem] truncate text-xs text-secondary">
                                {item.hookKey}
                              </code>
                            ) : null}
                            {item.submissionId ? (
                              <span className="block max-w-[10rem] truncate font-mono text-[11px] text-muted">
                                {item.submissionId}
                              </span>
                            ) : (
                              !item.hookKey ? <span className="text-muted">—</span> : null
                            )}
                          </div>
                        ) : item.submissionId ? (
                          <span className="block max-w-[10rem] truncate font-mono text-xs text-secondary">
                            {item.submissionId}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {item.payloadPreview ? (
                          <code className="block max-w-xs truncate text-xs text-secondary">
                            {item.payloadPreview}
                          </code>
                        ) : item.errorMessage ? (
                          <span className="block max-w-xs truncate text-xs text-danger">
                            {item.errorMessage}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableContainer>

            <div className="mt-4 flex flex-col gap-3 border-t border-default pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-secondary">
                {t("flows.activity.pageLabel", { page: pageIndex + 1 })}
                {isFetching ? ` · ${t("flows.activity.loading")}` : ""}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={goPrevPage}
                  disabled={!canGoPrev || isFetching}
                  className="inline-flex items-center gap-1 rounded-lg border border-default px-3 py-1.5 text-sm text-primary transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                  {t("campaigns.previousPage")}
                </button>
                <button
                  type="button"
                  onClick={goNextPage}
                  disabled={!canGoNext || isFetching}
                  className="inline-flex items-center gap-1 rounded-lg border border-default px-3 py-1.5 text-sm text-primary transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t("campaigns.nextPage")}
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <FlowActivityDetailModal
        flowId={flowId}
        item={selectedItem}
        nodes={nodes}
        onClose={() => setSelectedItem(null)}
      />
    </div>
  );
}
