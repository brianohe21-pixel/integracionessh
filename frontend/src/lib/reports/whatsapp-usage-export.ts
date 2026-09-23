import * as XLSX from "xlsx";
import { buildCsv, downloadCsvFile } from "@/lib/csv";
import type { WhatsAppUsageDailyPoint, WhatsAppUsageReport } from "@/types";

export type WhatsAppUsageExportLabels = {
  headers: string[];
  sheetName: string;
};

function pointToRow(point: WhatsAppUsageDailyPoint): string[] {
  return [
    point.date,
    String(point.apiOutbound),
    String(point.appEcho),
    String(point.inbound),
    String(point.total),
  ];
}

function buildFilename(report: WhatsAppUsageReport, extension: "csv" | "xlsx"): string {
  return `whatsapp-usage-${report.from}-${report.to}.${extension}`;
}

export function downloadWhatsAppUsageCsv(
  report: WhatsAppUsageReport,
  labels: WhatsAppUsageExportLabels
): void {
  const rows = report.daily.map(pointToRow);
  downloadCsvFile(buildFilename(report, "csv"), buildCsv(labels.headers, rows));
}

export function downloadWhatsAppUsageExcel(
  report: WhatsAppUsageReport,
  labels: WhatsAppUsageExportLabels
): void {
  const rows = report.daily.map(pointToRow);
  const worksheet = XLSX.utils.aoa_to_sheet([labels.headers, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, labels.sheetName.slice(0, 31));
  XLSX.writeFile(workbook, buildFilename(report, "xlsx"));
}
