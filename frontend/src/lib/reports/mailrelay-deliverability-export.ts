import { downloadCsvFile, escapeCsvCell } from "@/lib/csv";
import type { MailrelayDeliverabilityReport } from "@/types";

export type MailrelayDeliverabilityExportLabels = {
  campaign: string;
  date: string;
  sent: string;
  delivered: string;
  opens: string;
  clicks: string;
  bounces: string;
  hardBounces: string;
  softBounces: string;
  genericBounces: string;
  unsubscribes: string;
  complaints: string;
  hardBounceRate: string;
  softBounceRate: string;
  complaintRate: string;
  unsubscribeRate: string;
  campaignsTitle: string;
  seriesTitle: string;
  filenamePrefix: string;
};

type CountRow = {
  sent: number;
  delivered: number;
  opens: number;
  clicks: number;
  bounces: number;
  hardBounces: number;
  softBounces: number;
  genericBounces: number;
  unsubscribes: number;
  complaints: number;
};

function percent(value: number, total: number): string {
  if (total <= 0) return "0.0%";
  return `${((value / total) * 100).toFixed(1)}%`;
}

function line(cells: string[]): string {
  return cells.map((cell) => escapeCsvCell(cell)).join(",");
}

function metricHeaders(labels: MailrelayDeliverabilityExportLabels): string[] {
  return [
    labels.sent,
    labels.delivered,
    labels.opens,
    labels.clicks,
    labels.bounces,
    labels.hardBounces,
    labels.softBounces,
    labels.genericBounces,
    labels.unsubscribes,
    labels.complaints,
    labels.hardBounceRate,
    labels.softBounceRate,
    labels.complaintRate,
    labels.unsubscribeRate,
  ];
}

function countCells(row: CountRow): string[] {
  const deliveredBase = row.delivered || row.sent;
  return [
    String(row.sent),
    String(row.delivered),
    String(row.opens),
    String(row.clicks),
    String(row.bounces),
    String(row.hardBounces),
    String(row.softBounces),
    String(row.genericBounces),
    String(row.unsubscribes),
    String(row.complaints),
    percent(row.hardBounces, row.sent),
    percent(row.softBounces, row.sent),
    percent(row.complaints, deliveredBase),
    percent(row.unsubscribes, deliveredBase),
  ];
}

function hasActivity(row: CountRow): boolean {
  return (
    row.sent +
      row.delivered +
      row.opens +
      row.clicks +
      row.bounces +
      row.unsubscribes +
      row.complaints >
    0
  );
}

export function downloadMailrelayDeliverabilityCsv(
  report: MailrelayDeliverabilityReport,
  labels: MailrelayDeliverabilityExportLabels
): void {
  const sections = [
    line([labels.campaignsTitle]),
    line([labels.campaign, ...metricHeaders(labels)]),
    ...report.campaigns.map((row) => line([row.name, ...countCells(row)])),
  ];

  const dailyRows = report.campaigns.flatMap((campaign) =>
    campaign.daily
      .filter(hasActivity)
      .map((point) => line([point.date, campaign.name, ...countCells(point)]))
  );
  if (dailyRows.length > 0) {
    sections.push(
      "",
      line([labels.seriesTitle]),
      line([labels.date, labels.campaign, ...metricHeaders(labels)]),
      ...dailyRows
    );
  }

  const slug = report.from && report.to ? `${report.from}-${report.to}` : "lifetime";
  downloadCsvFile(`${labels.filenamePrefix}-${slug}.csv`, `\uFEFF${sections.join("\n")}`);
}
