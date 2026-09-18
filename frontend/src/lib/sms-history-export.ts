import * as XLSX from "xlsx";
import { api } from "@/lib/api";
import { buildCsv, downloadCsvFile } from "@/lib/csv";
import type { SmsHistoryFilters } from "@/hooks/useSms";
import type { SmsHistoryItem, SmsHistoryPage } from "@/types";

const EXPORT_PAGE_SIZE = 100;

export type SmsHistoryExportLabels = {
  headers: string[];
  formatSource: (source: SmsHistoryItem["source"]) => string;
  formatStatus: (status: SmsHistoryItem["status"]) => string;
  formatDate: (iso: string) => string;
};

function buildHistoryQuery(filters: SmsHistoryFilters, cursor?: string): string {
  const params = new URLSearchParams();
  params.set("limit", String(EXPORT_PAGE_SIZE));
  if (cursor) params.set("cursor", cursor);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.source && filters.source !== "all") params.set("source", filters.source);
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  return `?${params.toString()}`;
}

async function fetchSmsHistoryPage(
  filters: SmsHistoryFilters,
  cursor?: string
): Promise<SmsHistoryPage> {
  return api.get<SmsHistoryPage>(`/metrics/sms/history${buildHistoryQuery(filters, cursor)}`);
}

export async function fetchAllSmsHistory(filters: SmsHistoryFilters): Promise<SmsHistoryItem[]> {
  const items: SmsHistoryItem[] = [];
  let cursor: string | undefined;

  do {
    const page = await fetchSmsHistoryPage(filters, cursor);
    items.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);

  return items;
}

function historyToRow(item: SmsHistoryItem, labels: SmsHistoryExportLabels): string[] {
  return [
    labels.formatDate(item.createdAt),
    item.to,
    labels.formatSource(item.source),
    labels.formatStatus(item.status),
    item.templateName ?? "",
    item.campaignId ?? "",
    item.telcoredMessageId ?? "",
    item.receiptId,
    item.sendError ?? "",
    item.dlrAt ? labels.formatDate(item.dlrAt) : "",
  ];
}

function buildExportFilename(extension: "csv" | "xlsx"): string {
  const date = new Date().toISOString().slice(0, 10);
  return `sms_sends_${date}.${extension}`;
}

export async function downloadSmsHistoryCsv(
  filters: SmsHistoryFilters,
  labels: SmsHistoryExportLabels
): Promise<number> {
  const items = await fetchAllSmsHistory(filters);
  if (items.length === 0) return 0;

  const rows = items.map((item) => historyToRow(item, labels));
  downloadCsvFile(buildExportFilename("csv"), buildCsv(labels.headers, rows));
  return items.length;
}

export async function downloadSmsHistoryExcel(
  filters: SmsHistoryFilters,
  labels: SmsHistoryExportLabels
): Promise<number> {
  const items = await fetchAllSmsHistory(filters);
  if (items.length === 0) return 0;

  const rows = items.map((item) => historyToRow(item, labels));
  const worksheet = XLSX.utils.aoa_to_sheet([labels.headers, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "SMS");
  XLSX.writeFile(workbook, buildExportFilename("xlsx"));
  return items.length;
}
