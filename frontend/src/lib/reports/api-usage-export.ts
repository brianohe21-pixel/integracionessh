import * as XLSX from "xlsx";
import { downloadCsvFile, escapeCsvCell } from "@/lib/csv";
import type {
  ApiUsageByEndpoint,
  ApiUsageByKey,
  ApiUsageDailyPoint,
  ApiUsageReport,
  ApiUsageWebhookStatus,
  ApiWebhookActivationStatus,
} from "@/types";

export type ApiUsageExportLabels = {
  totalsTitle: string;
  dailyTitle: string;
  byKeyTitle: string;
  byEndpointTitle: string;
  webhooksTitle: string;
  countHeaders: string[];
  dailyHeaders: string[];
  byKeyHeaders: string[];
  byEndpointHeaders: string[];
  webhookHeaders: string[];
  active: string;
  inactive: string;
  filenamePrefix: string;
};

function statusLabel(status: ApiWebhookActivationStatus, labels: ApiUsageExportLabels): string {
  return status === "active" ? labels.active : labels.inactive;
}

function countCells(row: { requests: number; success: number; error: number }): string[] {
  return [String(row.requests), String(row.success), String(row.error)];
}

function dailyRow(row: ApiUsageDailyPoint): string[] {
  return [row.date, ...countCells(row)];
}

function keyRow(row: ApiUsageByKey): string[] {
  return [row.keyName, row.prefix, ...countCells(row)];
}

function endpointRow(row: ApiUsageByEndpoint): string[] {
  return [row.endpoint, row.method, ...countCells(row)];
}

function webhookRow(row: ApiUsageWebhookStatus, labels: ApiUsageExportLabels): string[] {
  return [statusLabel(row.status, labels), row.url, row.events.join(", ")];
}

function csvSection(title: string, headers: string[], rows: string[][]): string {
  const lines = [
    escapeCsvCell(title),
    headers.map((cell) => escapeCsvCell(cell)).join(","),
    ...rows.map((row) => row.map((cell) => escapeCsvCell(String(cell ?? ""))).join(",")),
  ];
  return lines.join("\n");
}

function buildFilename(from: string, to: string, prefix: string, extension: "csv" | "xlsx"): string {
  return `${prefix}-${from}-${to}.${extension}`;
}

export function downloadApiUsageCsv(
  report: ApiUsageReport,
  labels: ApiUsageExportLabels
): void {
  const content = `\uFEFF${[
    csvSection(labels.totalsTitle, labels.countHeaders, [countCells(report.totals)]),
    csvSection(labels.dailyTitle, labels.dailyHeaders, report.daily.map(dailyRow)),
    csvSection(labels.byKeyTitle, labels.byKeyHeaders, report.byKey.map(keyRow)),
    csvSection(
      labels.byEndpointTitle,
      labels.byEndpointHeaders,
      report.byEndpoint.map(endpointRow)
    ),
    csvSection(
      labels.webhooksTitle,
      labels.webhookHeaders,
      report.webhooks.map((row) => webhookRow(row, labels))
    ),
  ].join("\n\n")}`;

  downloadCsvFile(
    buildFilename(report.from, report.to, labels.filenamePrefix, "csv"),
    content
  );
}

function appendSheet(
  workbook: XLSX.WorkBook,
  name: string,
  headers: string[],
  rows: string[][]
): void {
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  XLSX.utils.book_append_sheet(workbook, sheet, name.slice(0, 31));
}

export function downloadApiUsageExcel(
  report: ApiUsageReport,
  labels: ApiUsageExportLabels
): void {
  const workbook = XLSX.utils.book_new();
  appendSheet(workbook, labels.totalsTitle, labels.countHeaders, [countCells(report.totals)]);
  appendSheet(workbook, labels.dailyTitle, labels.dailyHeaders, report.daily.map(dailyRow));
  appendSheet(workbook, labels.byKeyTitle, labels.byKeyHeaders, report.byKey.map(keyRow));
  appendSheet(
    workbook,
    labels.byEndpointTitle,
    labels.byEndpointHeaders,
    report.byEndpoint.map(endpointRow)
  );
  appendSheet(
    workbook,
    labels.webhooksTitle,
    labels.webhookHeaders,
    report.webhooks.map((row) => webhookRow(row, labels))
  );
  XLSX.writeFile(workbook, buildFilename(report.from, report.to, labels.filenamePrefix, "xlsx"));
}
