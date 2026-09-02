"use client";

import Link from "next/link";
import { Banknote, ArrowRight } from "lucide-react";
import { useMemo } from "react";
import { useT } from "@/i18n/context";
import { useSalesMetrics } from "@/hooks/useSalesMetrics";
import { useApps } from "@/hooks/useApps";
import { useFormatters } from "@/hooks/useFormatters";
import { dateRangeFromDays } from "@/lib/metrics-date-range";
import { CardContent, CardIconHeader } from "@/components/ui/Card";

export function SalesSummaryCard() {
  const t = useT();
  const { formatCurrency, formatNumber } = useFormatters();
  const range = useMemo(() => dateRangeFromDays(30), []);
  const { data: sales, isLoading } = useSalesMetrics(range);
  const { data: apps } = useApps();

  const hasPaymentsEnabled = (apps?.apps ?? []).some(
    (app) =>
      app.id === "payments" && app.installedBots.some((bot) => bot.enabled)
  );

  if (!hasPaymentsEnabled && !isLoading && (sales?.paidCount ?? 0) === 0) {
    return null;
  }

  if (isLoading) {
    return <div className="content-card h-28 animate-pulse" />;
  }

  if (!sales) return null;

  return (
    <div className="content-card mb-6 overflow-hidden">
      <CardIconHeader
        icon={<Banknote className="h-4 w-4" />}
        title={t("bots.salesSummaryTitle")}
      />
      <CardContent>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-2xl font-bold text-primary">
              {formatCurrency(sales.totalRevenueInCents)}
            </p>
            <p className="mt-1 text-sm text-secondary">
              {t("bots.salesSummarySub", {
                count: formatNumber(sales.paidCount),
                days: 30,
              })}
            </p>
          </div>
          <Link
            href="/metrics?section=sales"
            className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline"
          >
            {t("bots.salesSummaryViewDetail")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </CardContent>
    </div>
  );
}
