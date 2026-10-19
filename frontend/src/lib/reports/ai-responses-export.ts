import * as XLSX from "xlsx";
import { buildCsv, downloadCsvFile } from "@/lib/csv";
import type { AiResponsesReport } from "@/types";

export type AiResponsesExportLabels = {
  dailyHeaders: string[];
  byBotHeaders: string[];
  periodsHeaders: string[];
  dailySheet: string;
  byBotSheet: string;
  periodsSheet: string;
};

function buildFilename(report: AiResponsesReport, extension: "csv" | "xlsx"): string {
  return `ai-responses-${report.from}-${report.to}.${extension}`;
}

export function downloadAiResponsesCsv(
  report: AiResponsesReport,
  labels: AiResponsesExportLabels
): void {
  const dailyRows = report.daily.map((point) => [
    point.date,
    String(point.responses),
  ]);
  downloadCsvFile(
    buildFilename(report, "csv").replace(".csv", "-daily.csv"),
    buildCsv(labels.dailyHeaders, dailyRows)
  );
}

export function downloadAiResponsesExcel(
  report: AiResponsesReport,
  labels: AiResponsesExportLabels
): void {
  const workbook = XLSX.utils.book_new();

  const dailyRows = report.daily.map((point) => [point.date, point.responses]);
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([labels.dailyHeaders, ...dailyRows]),
    labels.dailySheet.slice(0, 31)
  );

  const byBotRows = report.byBot.map((row) => [
    row.botName,
    row.botId,
    row.responses,
  ]);
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([labels.byBotHeaders, ...byBotRows]),
    labels.byBotSheet.slice(0, 31)
  );

  const periodRows = report.periods.map((row) => [
    row.period,
    row.responses,
    row.planLimit,
    row.effectiveLimit,
    row.planUsed,
    row.bonusUsed,
    row.remaining,
    row.percentUsed,
  ]);
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([labels.periodsHeaders, ...periodRows]),
    labels.periodsSheet.slice(0, 31)
  );

  XLSX.writeFile(workbook, buildFilename(report, "xlsx"));
}
