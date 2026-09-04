"use client";

import { useBillingUsage } from "@/hooks/useBilling";
import { useFormatters } from "@/hooks/useFormatters";
import { useT } from "@/i18n/context";
import { CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import {
  SettingsCard,
  SettingsCardSkeleton,
  SettingsMetricRow,
} from "@/components/settings/SettingsCard";
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
    return <SettingsCardSkeleton lines={4} />;
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
    <SettingsCard
      icon={<CreditCard className="h-4 w-4" />}
      title={t("billing.title")}
      description={t("billing.currentPlan")}
      badge={<Badge variant="info">{planLabel(data.plan)}</Badge>}
      footer={!hideActions ? <BillingActions /> : undefined}
    >
      {data.subscription && data.subscription !== "none" ? (
        <p className="text-sm text-muted">
          {t(`billing.subscriptionStatus.${data.subscription}`)}
        </p>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        {rows.map((row) => (
          <SettingsMetricRow key={row.label} label={row.label} used={row.used} max={row.max} />
        ))}
      </div>
    </SettingsCard>
  );
}
