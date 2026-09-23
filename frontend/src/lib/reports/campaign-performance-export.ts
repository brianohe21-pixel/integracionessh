import * as XLSX from "xlsx";
import { buildCsv, downloadCsvFile } from "@/lib/csv";
import type {
  CampaignPerformanceReport,
  CampaignPerformanceRow,
  CampaignTemplateAggregate,
} from "@/types";

export type CampaignPerformanceExportLabels = {
  campaignHeaders: string[];
  templateHeaders: string[];
  campaignsSheetName: string;
  templatesSheetName: string;
};

function campaignToRow(row: CampaignPerformanceRow): string[] {
  return [
    row.name,
    row.templateName,
    row.language,
    row.status,
    row.startedAt ?? row.createdAt.slice(0, 10),
    String(row.sent),
    String(row.delivered),
    String(row.read),
    String(row.failed),
    String(row.deliveryFailed),
    String(row.replies),
    String(row.deliveryRate),
    String(row.readRate),
    String(row.replyRate),
  ];
}

function templateToRow(row: CampaignTemplateAggregate): string[] {
  return [
    row.templateName,
    row.language,
    String(row.campaigns),
    String(row.sent),
    String(row.delivered),
    String(row.read),
    String(row.failed),
    String(row.deliveryFailed),
    String(row.replies),
    String(row.deliveryRate),
    String(row.readRate),
    String(row.replyRate),
  ];
}

function buildFilename(
  report: CampaignPerformanceReport,
  extension: "csv" | "xlsx"
): string {
  return `campaign-performance-${report.from}-${report.to}.${extension}`;
}

export function downloadCampaignPerformanceCsv(
  report: CampaignPerformanceReport,
  labels: CampaignPerformanceExportLabels
): void {
  const rows = report.campaigns.map(campaignToRow);
  downloadCsvFile(
    buildFilename(report, "csv"),
    buildCsv(labels.campaignHeaders, rows)
  );
}

export function downloadCampaignPerformanceExcel(
  report: CampaignPerformanceReport,
  labels: CampaignPerformanceExportLabels
): void {
  const campaignRows = report.campaigns.map(campaignToRow);
  const templateRows = report.byTemplate.map(templateToRow);
  const workbook = XLSX.utils.book_new();
  const campaignsSheet = XLSX.utils.aoa_to_sheet([
    labels.campaignHeaders,
    ...campaignRows,
  ]);
  XLSX.utils.book_append_sheet(
    workbook,
    campaignsSheet,
    labels.campaignsSheetName.slice(0, 31)
  );
  const templatesSheet = XLSX.utils.aoa_to_sheet([
    labels.templateHeaders,
    ...templateRows,
  ]);
  XLSX.utils.book_append_sheet(
    workbook,
    templatesSheet,
    labels.templatesSheetName.slice(0, 31)
  );
  XLSX.writeFile(workbook, buildFilename(report, "xlsx"));
}
