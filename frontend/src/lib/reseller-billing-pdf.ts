import { isUnlimitedLimit } from "@/lib/subaccount-services";
import { downloadBillingReportPdf } from "@/lib/billing-report-pdf";
import type { MonthlyUsage, ResellerLimitsOverride, Tenant } from "@/types";

type SubaccountWithUsage = Tenant & { usage?: MonthlyUsage };

function formatLimit(value: number | undefined, unlimitedLabel: string): string {
  if (value === undefined || value === null) return "—";
  if (isUnlimitedLimit(value)) return unlimitedLabel;
  return String(value);
}

function formatUsageCell(used: number, limit: number | undefined, unlimitedLabel: string): string {
  return `${used} / ${formatLimit(limit, unlimitedLabel)}`;
}

export async function downloadResellerBillingPdf(params: {
  items: SubaccountWithUsage[];
  usagePeriod?: string;
  usageTotals?: Omit<MonthlyUsage, "tenantId">;
  bagTotal?: ResellerLimitsOverride;
  labels: {
    title: string;
    hint: string;
    period: string;
    unlimited: string;
    messages: string;
    bulk: string;
    campaigns: string;
    voiceMinutes: string;
    accountName: string;
    filenamePrefix: string;
  };
}): Promise<void> {
  const totals = params.usageTotals ?? {
    period: params.usagePeriod ?? "",
    messagesCount: 0,
    bulkRecipientsCount: 0,
    campaignsStarted: 0,
    voicebotMinutesCount: 0,
  };

  const period = params.usagePeriod ?? totals.period ?? "";
  const summaryLines = [
    `${params.labels.messages}: ${totals.messagesCount} / ${formatLimit(
      params.bagTotal?.maxMessagesPerMonth,
      params.labels.unlimited
    )}`,
    `${params.labels.bulk}: ${totals.bulkRecipientsCount}`,
    `${params.labels.campaigns}: ${totals.campaignsStarted} / ${formatLimit(
      params.bagTotal?.maxActiveCampaigns,
      params.labels.unlimited
    )}`,
    `${params.labels.voiceMinutes}: ${totals.voicebotMinutesCount ?? 0} / ${formatLimit(
      params.bagTotal?.maxVoicebotMinutesPerMonth,
      params.labels.unlimited
    )}`,
  ];

  const rows = params.items.map((item) => {
    const usage = item.usage;
    const limits = item.serviceLimits ?? {};
    return [
      item.name,
      formatUsageCell(usage?.messagesCount ?? 0, limits.maxMessagesPerMonth, params.labels.unlimited),
      formatUsageCell(
        usage?.bulkRecipientsCount ?? 0,
        limits.maxBulkRecipientsPerJob,
        params.labels.unlimited
      ),
      formatUsageCell(
        usage?.campaignsStarted ?? 0,
        limits.maxActiveCampaigns,
        params.labels.unlimited
      ),
      formatUsageCell(
        usage?.voicebotMinutesCount ?? 0,
        limits.maxVoicebotMinutesPerMonth,
        params.labels.unlimited
      ),
    ];
  });

  const periodSlug = period.replace(/\s+/g, "-").replace(/[^\w-]/g, "") || "report";

  await downloadBillingReportPdf({
    title: params.labels.title,
    subtitle: period ? `${params.labels.period}: ${period}` : params.labels.hint,
    summaryLines,
    columns: [
      params.labels.accountName,
      params.labels.messages,
      params.labels.bulk,
      params.labels.campaigns,
      params.labels.voiceMinutes,
    ],
    rows,
    filename: `${params.labels.filenamePrefix}-${periodSlug}.pdf`,
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

export async function downloadResellerCompanyBillingPdf(params: {
  item: SubaccountWithUsage;
  usagePeriod?: string;
  labels: {
    title: string;
    period: string;
    metric: string;
    value: string;
    unlimited: string;
    messages: string;
    bulk: string;
    campaigns: string;
    voiceMinutes: string;
    accountName: string;
    filenamePrefix: string;
  };
}): Promise<void> {
  const usage = params.item.usage;
  const limits = params.item.serviceLimits ?? {};
  const period = params.usagePeriod ?? usage?.period ?? "";

  const detailRows = [
    [params.labels.accountName, params.item.name],
    [
      params.labels.messages,
      formatUsageCell(usage?.messagesCount ?? 0, limits.maxMessagesPerMonth, params.labels.unlimited),
    ],
    [
      params.labels.bulk,
      formatUsageCell(
        usage?.bulkRecipientsCount ?? 0,
        limits.maxBulkRecipientsPerJob,
        params.labels.unlimited
      ),
    ],
    [
      params.labels.campaigns,
      formatUsageCell(
        usage?.campaignsStarted ?? 0,
        limits.maxActiveCampaigns,
        params.labels.unlimited
      ),
    ],
    [
      params.labels.voiceMinutes,
      formatUsageCell(
        usage?.voicebotMinutesCount ?? 0,
        limits.maxVoicebotMinutesPerMonth,
        params.labels.unlimited
      ),
    ],
  ];

  const periodSlug = period.replace(/\s+/g, "-").replace(/[^\w-]/g, "") || "report";
  const companySlug = slugifyFilename(params.item.name) || params.item.tenantId.slice(0, 8);

  await downloadBillingReportPdf({
    title: `${params.item.name} — ${params.labels.title}`,
    subtitle: period ? `${params.labels.period}: ${period}` : undefined,
    columns: [params.labels.metric, params.labels.value],
    rows: detailRows,
    filename: `${params.labels.filenamePrefix}-${companySlug}-${periodSlug}.pdf`,
  });
}
