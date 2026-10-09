import * as XLSX from "xlsx";
import { buildCsv, downloadCsvFile } from "@/lib/csv";
import type { MessageWindowDailyPoint, MessageWindowReport } from "@/types";

export type MessageWindowExportLabels = {
  headers: string[];
  sheetName: string;
};

function pointToRow(point: MessageWindowDailyPoint): string[] {
  return [
    point.date,
    String(point.inboundService24h),
    String(point.outboundService24h),
    String(point.inboundFreeEntry72h),
    String(point.outboundFreeEntry72h),
    String(point.inboundOutsideWindow),
    String(point.outboundOutsideWindow),
    String(point.total),
  ];
}

function buildFilename(report: MessageWindowReport, extension: "csv" | "xlsx"): string {
  return `message-windows-${report.from}-${report.to}.${extension}`;
}

export function downloadMessageWindowCsv(
  report: MessageWindowReport,
  labels: MessageWindowExportLabels
): void {
  const rows = report.daily.map(pointToRow);
  downloadCsvFile(buildFilename(report, "csv"), buildCsv(labels.headers, rows));
}

export function downloadMessageWindowExcel(
  report: MessageWindowReport,
  labels: MessageWindowExportLabels
): void {
  const rows = report.daily.map(pointToRow);
  const worksheet = XLSX.utils.aoa_to_sheet([labels.headers, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, labels.sheetName.slice(0, 31));
  XLSX.writeFile(workbook, buildFilename(report, "xlsx"));
}
