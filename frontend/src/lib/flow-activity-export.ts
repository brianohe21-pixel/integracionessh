import * as XLSX from "xlsx";
import { api } from "@/lib/api";
import { buildCsv, downloadCsvFile } from "@/lib/csv";
import type { FlowActivityFilters } from "@/hooks/useFlows";
import type { FlowActivityPage, FlowActivitySummary } from "@/types";

const EXPORT_PAGE_SIZE = 100;

export type FlowActivityExportFilters = Pick<FlowActivityFilters, "status" | "source" | "q">;

export type FlowActivityExportLabels = {
  headers: string[];
  formatSource: (source: FlowActivitySummary["source"]) => string;
  formatStatus: (status: FlowActivitySummary["status"]) => string;
  formatDate: (iso: string) => string;
};

async function fetchFlowActivityPage(
  flowId: string,
  filters: FlowActivityExportFilters & { limit: number; cursor?: string }
): Promise<FlowActivityPage> {
  const params = new URLSearchParams();
  params.set("limit", String(filters.limit));
  if (filters.cursor) params.set("cursor", filters.cursor);
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.source && filters.source !== "all") params.set("source", filters.source);
  if (filters.q.trim()) params.set("q", filters.q.trim());
  return api.get<FlowActivityPage>(
    `/flows/${encodeURIComponent(flowId)}/activity?${params.toString()}`
  );
}

export async function fetchAllFlowActivity(
  flowId: string,
  filters: FlowActivityExportFilters
): Promise<FlowActivitySummary[]> {
  const items: FlowActivitySummary[] = [];
  let cursor: string | undefined;

  do {
    const page = await fetchFlowActivityPage(flowId, {
      ...filters,
      limit: EXPORT_PAGE_SIZE,
      cursor,
    });
    items.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);

  return items;
}

function contactCell(item: FlowActivitySummary): string {
  return item.customerPhone ?? item.conversationId ?? item.submissionId ?? "";
}

function webhookCell(item: FlowActivitySummary): string {
  if (item.kind === "event" || item.source === "webhook") {
    return [item.hookKey, item.submissionId].filter(Boolean).join(" / ");
  }
  return item.submissionId ?? "";
}

function payloadCell(item: FlowActivitySummary): string {
  return item.payloadPreview ?? item.errorMessage ?? "";
}

function activityToRow(item: FlowActivitySummary, labels: FlowActivityExportLabels): string[] {
  return [
    labels.formatDate(item.createdAt),
    labels.formatSource(item.source ?? "conversation"),
    labels.formatStatus(item.status),
    contactCell(item),
    typeof item.stepCount === "number" ? String(item.stepCount) : "",
    webhookCell(item),
    payloadCell(item),
    item.runId ?? "",
    item.submissionId ?? "",
    item.conversationId ?? "",
    item.idempotencyKey ?? "",
    item.activityId,
  ];
}

function buildExportFilename(flowId: string, extension: "csv" | "xlsx"): string {
  const date = new Date().toISOString().slice(0, 10);
  return `flow_activity_${flowId.slice(0, 8)}_${date}.${extension}`;
}

export async function downloadFlowActivityCsv(
  flowId: string,
  filters: FlowActivityExportFilters,
  labels: FlowActivityExportLabels
): Promise<number> {
  const items = await fetchAllFlowActivity(flowId, filters);
  if (items.length === 0) return 0;

  const rows = items.map((item) => activityToRow(item, labels));
  downloadCsvFile(buildExportFilename(flowId, "csv"), buildCsv(labels.headers, rows));
  return items.length;
}

export async function downloadFlowActivityExcel(
  flowId: string,
  filters: FlowActivityExportFilters,
  labels: FlowActivityExportLabels
): Promise<number> {
  const items = await fetchAllFlowActivity(flowId, filters);
  if (items.length === 0) return 0;

  const rows = items.map((item) => activityToRow(item, labels));
  const worksheet = XLSX.utils.aoa_to_sheet([labels.headers, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Activity");
  XLSX.writeFile(workbook, buildExportFilename(flowId, "xlsx"));
  return items.length;
}
