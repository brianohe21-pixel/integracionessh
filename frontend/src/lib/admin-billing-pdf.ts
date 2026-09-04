import { downloadBillingReportPdf } from "@/lib/billing-report-pdf";
import type { AdminBillingOverview } from "@/types";

function formatCents(cents: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export async function downloadAdminBillingPdf(params: {
  overview: AdminBillingOverview;
  labels: {
    title: string;
    period: string;
    totalMessages: string;
    totalEstimated: string;
    companyName: string;
    email: string;
    plan: string;
    messagesCount: string;
    bulkRecipients: string;
    unitPrice: string;
    estimatedCost: string;
    filenamePrefix: string;
  };
}): Promise<void> {
  const { overview, labels } = params;

  const summaryLines = [
    `${labels.totalMessages}: ${overview.totals.messagesCount.toLocaleString()}`,
    `${labels.totalEstimated}: ${formatCents(overview.totals.estimatedMessageCostCents)}`,
  ];

  const rows = overview.rows.map((row) => [
    row.name,
    row.email,
    row.plan,
    row.messagesCount.toLocaleString(),
    row.bulkRecipientsCount.toLocaleString(),
    formatCents(row.pricePerMessageCents),
    formatCents(row.estimatedMessageCostCents),
  ]);

  const periodSlug = overview.period.replace(/\s+/g, "-").replace(/[^\w-]/g, "") || "report";

  await downloadBillingReportPdf({
    title: labels.title,
    subtitle: `${labels.period}: ${overview.period}`,
    summaryLines,
    columns: [
      labels.companyName,
      labels.email,
      labels.plan,
      labels.messagesCount,
      labels.bulkRecipients,
      labels.unitPrice,
      labels.estimatedCost,
    ],
    rows,
    filename: `${labels.filenamePrefix}-${periodSlug}.pdf`,
  });
}

function slugifyFilename(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 48);
}

export async function downloadAdminCompanyBillingPdf(params: {
  row: AdminBillingOverview["rows"][number];
  period: string;
  labels: {
    title: string;
    period: string;
    metric: string;
    value: string;
    companyName: string;
    email: string;
    plan: string;
    messagesCount: string;
    bulkRecipients: string;
    unitPrice: string;
    estimatedCost: string;
    filenamePrefix: string;
  };
}): Promise<void> {
  const { row, labels } = params;
  const unitPrice = formatCents(row.pricePerMessageCents);

  const detailRows = [
    [labels.companyName, row.name],
    [labels.email, row.email],
    [labels.plan, row.plan],
    [labels.messagesCount, row.messagesCount.toLocaleString()],
    [labels.bulkRecipients, row.bulkRecipientsCount.toLocaleString()],
    [labels.unitPrice, unitPrice],
    [labels.estimatedCost, formatCents(row.estimatedMessageCostCents)],
  ];

  const periodSlug = params.period.replace(/\s+/g, "-").replace(/[^\w-]/g, "") || "report";
  const companySlug = slugifyFilename(row.name) || row.tenantId.slice(0, 8);

  await downloadBillingReportPdf({
    title: `${row.name} — ${labels.title}`,
    subtitle: `${labels.period}: ${params.period}`,
    columns: [labels.metric, labels.value],
    rows: detailRows,
    filename: `${labels.filenamePrefix}-${companySlug}-${periodSlug}.pdf`,
  });
}
