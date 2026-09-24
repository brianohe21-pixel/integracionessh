import * as XLSX from "xlsx";
import { buildCsv, downloadCsvFile } from "@/lib/csv";
import type { MonthlyUsage } from "@/types";

export type PlanUsageExportLabels = {
  headers: string[];
  sheetName: string;
  filenamePrefix: string;
};

function periodToRow(period: MonthlyUsage): string[] {
  return [
    period.period,
    String(period.messagesCount ?? 0),
    String(period.bulkRecipientsCount ?? 0),
    String(period.campaignsStarted ?? 0),
    String(period.voicebotMinutesCount ?? 0),
  ];
}

function buildFilename(
  prefix: string,
  from: string,
  to: string,
  extension: "csv" | "xlsx"
): string {
  return `${prefix}-${from}-${to}.${extension}`;
}

export function downloadPlanUsageCsv(
  from: string,
  to: string,
  periods: MonthlyUsage[],
  labels: PlanUsageExportLabels
): void {
  downloadCsvFile(
    buildFilename(labels.filenamePrefix, from, to, "csv"),
    buildCsv(labels.headers, periods.map(periodToRow))
  );
}

export function downloadPlanUsageExcel(
  from: string,
  to: string,
  periods: MonthlyUsage[],
  labels: PlanUsageExportLabels
): void {
  const worksheet = XLSX.utils.aoa_to_sheet([
    labels.headers,
    ...periods.map(periodToRow),
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, labels.sheetName.slice(0, 31));
  XLSX.writeFile(workbook, buildFilename(labels.filenamePrefix, from, to, "xlsx"));
}
