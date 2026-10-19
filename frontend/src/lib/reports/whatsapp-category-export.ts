import * as XLSX from "xlsx";
import { buildCsv, downloadCsvFile } from "@/lib/csv";
import type { WhatsAppCategoryDailyPoint, WhatsAppCategoryReport } from "@/types";

export type WhatsAppCategoryExportLabels = {
  headers: string[];
  sheetName: string;
};

function pointToRow(point: WhatsAppCategoryDailyPoint): string[] {
  return [
    point.date,
    String(point.marketing),
    String(point.utility),
    String(point.authentication),
    String(point.service),
    String(point.total),
  ];
}

function buildFilename(report: WhatsAppCategoryReport, extension: "csv" | "xlsx"): string {
  return `whatsapp-categories-${report.from}-${report.to}.${extension}`;
}

export function downloadWhatsAppCategoryCsv(
  report: WhatsAppCategoryReport,
  labels: WhatsAppCategoryExportLabels
): void {
  const rows = report.daily.map(pointToRow);
  downloadCsvFile(buildFilename(report, "csv"), buildCsv(labels.headers, rows));
}

export function downloadWhatsAppCategoryExcel(
  report: WhatsAppCategoryReport,
  labels: WhatsAppCategoryExportLabels
): void {
  const rows = report.daily.map(pointToRow);
  const worksheet = XLSX.utils.aoa_to_sheet([labels.headers, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, labels.sheetName.slice(0, 31));
  XLSX.writeFile(workbook, buildFilename(report, "xlsx"));
}
