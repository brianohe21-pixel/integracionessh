import * as XLSX from "xlsx";
import { buildCsv, downloadCsvFile } from "@/lib/csv";
import type { ConversationsByClientReport, ConversationsByClientRow } from "@/types";

export type ConversationsByClientExportLabels = {
  headers: string[];
  sheetName: string;
};

function rowToCells(row: ConversationsByClientRow): string[] {
  return [
    row.clientName ?? "",
    row.clientKey,
    String(row.conversations),
    String(row.aiUsage),
    `${row.serviceMessagesUsed}/${row.serviceMessagesQuota}`,
    String(row.inbound),
    String(row.outbound),
  ];
}

function buildFilename(report: ConversationsByClientReport, extension: "csv" | "xlsx"): string {
  return `conversations-by-client-${report.from}-${report.to}.${extension}`;
}

export function downloadConversationsByClientCsv(
  report: ConversationsByClientReport,
  labels: ConversationsByClientExportLabels
): void {
  const rows = report.rows.map(rowToCells);
  downloadCsvFile(buildFilename(report, "csv"), buildCsv(labels.headers, rows));
}

export function downloadConversationsByClientExcel(
  report: ConversationsByClientReport,
  labels: ConversationsByClientExportLabels
): void {
  const rows = report.rows.map(rowToCells);
  const worksheet = XLSX.utils.aoa_to_sheet([labels.headers, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, labels.sheetName.slice(0, 31));
  XLSX.writeFile(workbook, buildFilename(report, "xlsx"));
}
