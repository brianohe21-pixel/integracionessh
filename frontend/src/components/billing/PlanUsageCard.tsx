"use client";

import { useBillingUsage } from "@/hooks/useBilling";
import { useFormatters } from "@/hooks/useFormatters";
import { useT } from "@/i18n/context";
import { CreditCard } from "lucide-react";
import { BillingActions } from "./BillingActions";

function formatLimit(value: number, t: (key: string) => string): string {
  if (value >= 1_000_000) return t("billing.unlimited");
  return String(value);
}

export function PlanUsageCard({ hideActions = false }: { hideActions?: boolean }) {
  const t = useT();
  const { planLabel } = useFormatters();
  const { data, isLoading } = useBillingUsage();

  if (isLoading || !data) {
    return (
      <div className="bg-surface-elevated rounded-xl border border-default p-6 animate-pulse h-48" />
    );
  }

  const monthlyBulkLimit = data.limits.maxMessagesPerMonth * 10;

  const rows = [
    {
      label: t("billing.usageBots"),
      used: "—",
      max: formatLimit(data.limits.maxActiveBots, t),
    },
    {
      label: t("billing.usageMessages"),
      used: String(data.usage.messagesCount ?? 0),
      max: formatLimit(data.limits.maxMessagesPerMonth, t),
    },
    {
      label: t("billing.usageBulk"),
      used: String(data.usage.bulkRecipientsCount ?? 0),
      max: formatLimit(monthlyBulkLimit, t),
    },
    {
      label: t("billing.usageCampaigns"),
      used: String(data.usage.campaignsStarted ?? 0),
      max: formatLimit(data.limits.maxActiveCampaigns, t),
    },
  ];

  return (
    <div className="bg-surface-elevated rounded-xl border border-default p-6">
      <div className="flex items-center gap-2 mb-4">
        <CreditCard className="w-4 h-4 text-secondary" />
        <h2 className="font-semibold text-primary text-sm">{t("billing.title")}</h2>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4 text-sm">
        <span className="text-secondary">{t("billing.currentPlan")}:</span>
        <span className="font-medium text-primary">{planLabel(data.plan)}</span>
        {data.subscription && data.subscription !== "none" && (
          <span className="text-muted">
            · {t(`billing.subscriptionStatus.${data.subscription}`)}
          </span>
        )}
      </div>

      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex justify-between text-sm py-1.5 border-b border-gray-50 last:border-0"
          >
            <span className="text-secondary">{row.label}</span>
            <span className="text-primary font-medium">
              {row.used} / {row.max}
            </span>
          </div>
        ))}
      </div>
      {!hideActions && <BillingActions />}
    </div>
  );
}
