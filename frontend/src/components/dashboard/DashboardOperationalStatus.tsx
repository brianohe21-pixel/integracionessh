"use client";

import Link from "next/link";
import { AlertTriangle, MessageSquare, CheckCircle2, Clock } from "lucide-react";
import { useT } from "@/i18n/context";
import { useFormatters } from "@/hooks/useFormatters";
import { formatElapsedDuration } from "@/lib/inbox-sla";
import { Badge } from "@/components/ui/Badge";
import { SkeletonCard } from "@/components/ui/Skeleton";
import type { MarketingMetrics, InboxSlaMetrics } from "@/types";

interface DashboardOperationalStatusProps {
  marketing?: MarketingMetrics | null;
  inboxSla?: InboxSlaMetrics | null;
  isLoadingMarketing: boolean;
  isLoadingSla: boolean;
}

export function DashboardOperationalStatus({
  marketing,
  inboxSla,
  isLoadingMarketing,
  isLoadingSla,
}: DashboardOperationalStatusProps) {
  const t = useT();
  const { formatNumber } = useFormatters();

  if (isLoadingMarketing || isLoadingSla) {
    return <SkeletonCard lines={3} />;
  }

  const inbox = marketing?.inbox;
  const slaEnabled = inboxSla?.enabled ?? false;
  const hasBreached = (inboxSla?.openBreached ?? 0) > 0;
  const hasAtRisk = (inboxSla?.openAtRisk ?? 0) > 0;
  const hasOpenInbox = (inbox?.open ?? 0) > 0;

  const items = [
    {
      key: "open",
      label: t("dashboard.opsInboxOpen"),
      value: formatNumber(inbox?.open ?? 0),
      sub: t("dashboard.opsInboxPending", { count: inbox?.pending ?? 0 }),
      icon: MessageSquare,
      href: "/conversations",
      alert: hasOpenInbox,
    },
    {
      key: "resolved",
      label: t("dashboard.opsResolvedToday"),
      value: formatNumber(inbox?.resolvedToday ?? 0),
      icon: CheckCircle2,
      href: "/conversations",
      alert: false,
    },
    ...(slaEnabled
      ? [
          {
            key: "sla-compliance",
            label: t("metrics.inboxSlaCompliance"),
            value: `${inboxSla?.complianceRate ?? 0}%`,
            sub: formatElapsedDuration(inboxSla?.averageResponseSeconds ?? 0),
            icon: Clock,
            href: "/metrics",
            alert: false,
          },
          {
            key: "sla-breached",
            label: t("metrics.inboxSlaOpenBreached"),
            value: formatNumber(inboxSla?.openBreached ?? 0),
            sub: t("dashboard.opsAtRisk", { count: inboxSla?.openAtRisk ?? 0 }),
            icon: AlertTriangle,
            href: "/supervisor",
            alert: hasBreached || hasAtRisk,
          },
        ]
      : []),
  ];

  return (
    <div className="content-card overflow-hidden">
      <div className="border-b border-subtle px-4 py-4 sm:px-6">
        <h2 className="text-sm font-semibold text-primary">{t("dashboard.opsTitle")}</h2>
        <p className="mt-0.5 text-xs text-secondary">{t("dashboard.opsSubtitle")}</p>
      </div>
      <div className="divide-y divide-subtle">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={item.href}
              className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface/50 sm:px-6"
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  item.alert ? "bg-danger/15 text-danger" : "bg-accent-muted text-accent"
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-secondary">{item.label}</p>
                <p className="text-lg font-bold text-primary">{item.value}</p>
                {item.sub ? <p className="text-xs text-muted">{item.sub}</p> : null}
              </div>
              {item.alert ? (
                <Badge variant="warning">{t("dashboard.opsNeedsAttention")}</Badge>
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
