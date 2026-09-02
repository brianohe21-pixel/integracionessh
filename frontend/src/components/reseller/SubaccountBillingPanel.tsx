"use client";

import { useT } from "@/i18n/context";
import { cn } from "@/lib/utils";
import { isUnlimitedLimit } from "@/lib/subaccount-services";
import type { MonthlyUsage, ResellerLimitsOverride, Tenant } from "@/types";
import { CreditCard } from "lucide-react";
import { TableContainer } from "@/components/ui/TableContainer";

type SubaccountWithUsage = Tenant & { usage?: MonthlyUsage };

function formatLimit(value: number | undefined, unlimitedLabel: string): string {
  if (value === undefined || value === null) return "—";
  if (isUnlimitedLimit(value)) return unlimitedLabel;
  return String(value);
}

function usagePct(used: number, limit: number | undefined): number | null {
  if (limit === undefined || isUnlimitedLimit(limit) || limit <= 0) return null;
  return Math.min(100, (used / limit) * 100);
}

function UsageCell({
  used,
  limit,
  unlimitedLabel,
}: {
  used: number;
  limit: number | undefined;
  unlimitedLabel: string;
}) {
  const pct = usagePct(used, limit);
  const nearLimit = pct !== null && pct >= 90;
  const overLimit = pct !== null && pct >= 100;

  return (
    <span
      className={cn(
        "tabular-nums font-medium",
        overLimit ? "text-danger" : nearLimit ? "text-warning" : "text-primary"
      )}
    >
      {used}
      <span className="text-secondary font-normal"> / {formatLimit(limit, unlimitedLabel)}</span>
    </span>
  );
}

function SummaryCard({
  label,
  used,
  limit,
  unlimitedLabel,
}: {
  label: string;
  used: number;
  limit?: number;
  unlimitedLabel: string;
}) {
  const pct = limit !== undefined ? usagePct(used, limit) : null;
  const barPct = pct !== null ? Math.min(100, pct) : 0;

  return (
    <div className="rounded-xl border border-default bg-surface p-3">
      <p className="text-[11px] font-medium text-secondary">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-primary">
        {used}
        {limit !== undefined ? (
          <span className="text-sm font-medium text-secondary">
            {" "}
            / {formatLimit(limit, unlimitedLabel)}
          </span>
        ) : null}
      </p>
      {pct !== null ? (
        <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-surface-muted">
          <span
            className={cn(
              "block h-full rounded-full",
              barPct >= 90 ? "bg-warning" : "bg-accent"
            )}
            style={{ width: `${barPct}%` }}
          />
        </span>
      ) : null}
    </div>
  );
}

export function SubaccountBillingPanel({
  items,
  usagePeriod,
  usageTotals,
  bagTotal,
}: {
  items?: SubaccountWithUsage[];
  usagePeriod?: string;
  usageTotals?: Omit<MonthlyUsage, "tenantId">;
  bagTotal?: ResellerLimitsOverride;
}) {
  const t = useT();
  const unlimitedLabel = t("reseller.unlimited");
  const list = items ?? [];

  if (!list.length) {
    return (
      <p className="text-sm text-secondary">{t("reseller.billingEmpty")}</p>
    );
  }

  const totals = usageTotals ?? {
    period: usagePeriod ?? "",
    messagesCount: 0,
    bulkRecipientsCount: 0,
    campaignsStarted: 0,
    voicebotMinutesCount: 0,
  };

  return (
    <section className="content-card space-y-5 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-muted text-accent">
          <CreditCard className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-primary">{t("reseller.billingTitle")}</h2>
          <p className="mt-0.5 text-sm text-secondary">
            {t("reseller.billingHint")}
            {usagePeriod ? (
              <span className="ml-1 text-muted">· {usagePeriod}</span>
            ) : null}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label={t("billing.usageMessages")}
          used={totals.messagesCount}
          limit={bagTotal?.maxMessagesPerMonth}
          unlimitedLabel={unlimitedLabel}
        />
        <SummaryCard
          label={t("billing.usageBulk")}
          used={totals.bulkRecipientsCount}
          unlimitedLabel={unlimitedLabel}
        />
        <SummaryCard
          label={t("billing.usageCampaigns")}
          used={totals.campaignsStarted}
          limit={bagTotal?.maxActiveCampaigns}
          unlimitedLabel={unlimitedLabel}
        />
        <SummaryCard
          label={t("reseller.limits.maxVoicebotMinutesPerMonth")}
          used={totals.voicebotMinutesCount ?? 0}
          limit={bagTotal?.maxVoicebotMinutesPerMonth}
          unlimitedLabel={unlimitedLabel}
        />
      </div>

      <TableContainer className="rounded-xl border border-default bg-surface-elevated">
        <table className="min-w-full text-sm">
          <thead className="bg-surface text-left text-secondary">
            <tr>
              <th className="px-4 py-3 font-medium">{t("reseller.name")}</th>
              <th className="px-4 py-3 font-medium">{t("billing.usageMessages")}</th>
              <th className="px-4 py-3 font-medium">{t("billing.usageBulk")}</th>
              <th className="px-4 py-3 font-medium">{t("billing.usageCampaigns")}</th>
              <th className="px-4 py-3 font-medium">
                {t("reseller.limits.maxVoicebotMinutesPerMonth")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {list.map((item) => {
              const usage = item.usage;
              const limits = item.serviceLimits ?? {};
              return (
                <tr key={item.tenantId}>
                  <td className="px-4 py-3 text-primary">{item.name}</td>
                  <td className="px-4 py-3">
                    <UsageCell
                      used={usage?.messagesCount ?? 0}
                      limit={limits.maxMessagesPerMonth}
                      unlimitedLabel={unlimitedLabel}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <UsageCell
                      used={usage?.bulkRecipientsCount ?? 0}
                      limit={limits.maxBulkRecipientsPerJob}
                      unlimitedLabel={unlimitedLabel}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <UsageCell
                      used={usage?.campaignsStarted ?? 0}
                      limit={limits.maxActiveCampaigns}
                      unlimitedLabel={unlimitedLabel}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <UsageCell
                      used={usage?.voicebotMinutesCount ?? 0}
                      limit={limits.maxVoicebotMinutesPerMonth}
                      unlimitedLabel={unlimitedLabel}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableContainer>
    </section>
  );
}
