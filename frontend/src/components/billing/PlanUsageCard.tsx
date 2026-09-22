"use client";

import { useBillingUsage } from "@/hooks/useBilling";
import { useFormatters } from "@/hooks/useFormatters";
import { useT } from "@/i18n/context";
import { BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import {
  SettingsCard,
  SettingsCardSkeleton,
} from "@/components/settings/SettingsCard";
import { BillingActions } from "./BillingActions";
import { cn } from "@/lib/utils";

function formatLimit(value: number, t: (key: string) => string): string {
  if (value >= 1_000_000) return t("billing.unlimited");
  return value.toLocaleString();
}

function UsageMetricBar({
  label,
  used,
  max,
  t,
}: {
  label: string;
  used: number;
  max: number;
  t: (key: string) => string;
}) {
  const unlimited = max >= 1_000_000;
  const percent = unlimited || max <= 0 ? 0 : Math.min(100, Math.round((used / max) * 100));
  const highUsage = !unlimited && percent >= 85;

  return (
    <div className="rounded-xl border border-subtle bg-surface px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-secondary">{label}</span>
        <span className="text-sm font-semibold tabular-nums text-primary">
          {used.toLocaleString()}
          <span className="font-normal text-muted"> / {formatLimit(max, t)}</span>
        </span>
      </div>
      {!unlimited ? (
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              highUsage ? "bg-warning" : "bg-accent"
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
      ) : null}
    </div>
  );
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
      label: t("billing.usageMessages"),
      used: data.usage.messagesCount ?? 0,
      max: data.limits.maxMessagesPerMonth,
    },
    {
      label: t("billing.usageBulk"),
      used: data.usage.bulkRecipientsCount ?? 0,
      max: monthlyBulkLimit,
    },
    {
      label: t("billing.usageCampaigns"),
      used: data.usage.campaignsStarted ?? 0,
      max: data.limits.maxActiveCampaigns,
    },
  ];

  return (
    <SettingsCard
      icon={<BarChart3 className="h-4 w-4" />}
      title={t("billing.title")}
      description={t("billing.usageSection")}
      badge={<Badge variant="info">{planLabel(data.plan)}</Badge>}
      footer={!hideActions ? <BillingActions /> : undefined}
    >
      {data.subscription && data.subscription !== "none" ? (
        <p className="text-sm text-muted">
          {t(`billing.subscriptionStatus.${data.subscription}`)}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => (
          <UsageMetricBar key={row.label} label={row.label} used={row.used} max={row.max} t={t} />
        ))}
      </div>
    </SettingsCard>
  );
}
