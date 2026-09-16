import { buildCsv, downloadCsvFile } from "@/lib/csv";
import { isUnlimitedLimit } from "@/lib/subaccount-services";
import type { MonthlyUsage, ResellerLimitsOverride, Tenant } from "@/types";

type SubaccountWithUsage = Tenant & { usage?: MonthlyUsage };

function formatLimit(value: number | undefined, unlimitedLabel: string): string {
  if (value === undefined || value === null) return "";
  if (isUnlimitedLimit(value)) return unlimitedLabel;
  return String(value);
}

function formatUsageCell(used: number, limit: number | undefined, unlimitedLabel: string): string {
  const limitLabel = formatLimit(limit, unlimitedLabel);
  return limitLabel ? `${used} / ${limitLabel}` : String(used);
}

function periodSlug(period: string): string {
  return period.replace(/\s+/g, "-").replace(/[^\w-]/g, "") || "report";
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

export function downloadResellerBillingCsv(params: {
  items: SubaccountWithUsage[];
  usagePeriod?: string;
  usageTotals?: Omit<MonthlyUsage, "tenantId">;
  bagTotal?: ResellerLimitsOverride;
  labels: {
    period: string;
    unlimited: string;
    messages: string;
    bulk: string;
    campaigns: string;
    voiceMinutes: string;
    accountName: string;
    email: string;
    filenamePrefix: string;
  };
}): void {
  const totals = params.usageTotals ?? {
    period: params.usagePeriod ?? "",
    messagesCount: 0,
    bulkRecipientsCount: 0,
    campaignsStarted: 0,
    voicebotMinutesCount: 0,
  };

  const period = params.usagePeriod ?? totals.period ?? "";
  const columns = [
    params.labels.accountName,
    params.labels.email,
    params.labels.messages,
    params.labels.bulk,
    params.labels.campaigns,
    params.labels.voiceMinutes,
  ];

  const rows = params.items.map((item) => {
    const usage = item.usage;
    const limits = item.serviceLimits ?? {};
    return [
      item.name,
      item.email ?? "",
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

  rows.push([
    "TOTAL",
    "",
    formatUsageCell(
      totals.messagesCount,
      params.bagTotal?.maxMessagesPerMonth,
      params.labels.unlimited
    ),
    String(totals.bulkRecipientsCount),
    formatUsageCell(
      totals.campaignsStarted,
      params.bagTotal?.maxActiveCampaigns,
      params.labels.unlimited
    ),
    formatUsageCell(
      totals.voicebotMinutesCount ?? 0,
      params.bagTotal?.maxVoicebotMinutesPerMonth,
      params.labels.unlimited
    ),
  ]);

  const headerComment = period ? `${params.labels.period}: ${period}` : "";
  const content = headerComment
    ? `${escapeCsvComment(headerComment)}\n${buildCsv(columns, rows)}`
    : buildCsv(columns, rows);

  downloadCsvFile(`${params.labels.filenamePrefix}-${periodSlug(period)}.csv`, content);
}

function escapeCsvComment(line: string): string {
  return `# ${line.replace(/\r?\n/g, " ")}`;
}

export function downloadResellerCompanyBillingCsv(params: {
  item: SubaccountWithUsage;
  usagePeriod?: string;
  labels: {
    period: string;
    metric: string;
    value: string;
    unlimited: string;
    messages: string;
    bulk: string;
    campaigns: string;
    voiceMinutes: string;
    accountName: string;
    email: string;
    filenamePrefix: string;
  };
}): void {
  const usage = params.item.usage;
  const limits = params.item.serviceLimits ?? {};
  const period = params.usagePeriod ?? usage?.period ?? "";

  const rows = [
    [params.labels.accountName, params.item.name],
    [params.labels.email, params.item.email ?? ""],
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

  const headerComment = period ? `${params.labels.period}: ${period}` : "";
  const content = headerComment
    ? `${escapeCsvComment(headerComment)}\n${buildCsv([params.labels.metric, params.labels.value], rows)}`
    : buildCsv([params.labels.metric, params.labels.value], rows);

  const companySlug = slugifyFilename(params.item.name) || params.item.tenantId.slice(0, 8);
  downloadCsvFile(
    `${params.labels.filenamePrefix}-${companySlug}-${periodSlug(period)}.csv`,
    content
  );
}
