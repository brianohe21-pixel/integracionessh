"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BotMessageSquare,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { useT } from "@/i18n/context";
import { useFormatters } from "@/hooks/useFormatters";
import { Skeleton } from "@/components/ui/Skeleton";
import type { UsageMetrics, MarketingMetrics, InboxSlaMetrics } from "@/types";

interface DashboardControlSummaryProps {
  usage?: UsageMetrics | null;
  marketing?: MarketingMetrics | null;
  inboxSla?: InboxSlaMetrics | null;
  isLoading: boolean;
}

export function DashboardControlSummary({
  usage,
  marketing,
  inboxSla,
  isLoading,
}: DashboardControlSummaryProps) {
  const t = useT();
  const { formatNumber } = useFormatters();

  if (isLoading) {
    return <Skeleton className="h-36 rounded-2xl" />;
  }

  const openInbox = marketing?.inbox?.open ?? 0;
  const pendingInbox = marketing?.inbox?.pending ?? 0;
  const activeBots = usage?.summary.activeBots ?? 0;
  const activeConversations = usage?.summary.activeConversations ?? 0;
  const slaBreached = inboxSla?.openBreached ?? 0;
  const slaAtRisk = inboxSla?.openAtRisk ?? 0;
  const hasAlert = openInbox > 0 || slaBreached > 0 || slaAtRisk > 0;

  return (
    <div className="content-card overflow-hidden">
      <div className="relative overflow-hidden border-b border-subtle bg-gradient-to-br from-accent-muted/60 via-surface-elevated to-surface-elevated px-5 py-5 sm:px-6">
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-accent/10 blur-2xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-accent-muted px-3 py-1 text-xs font-medium text-accent">
              <Sparkles className="h-3.5 w-3.5" />
              {t("dashboard.controlCenterBadge")}
            </div>
            <h2 className="text-lg font-semibold text-primary sm:text-xl">
              {t("dashboard.controlCenterTitle")}
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-secondary">
              {t("dashboard.controlCenterSubtitle")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/bots/new"
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-accent-hover hover:shadow-md active:scale-[0.98]"
            >
              <BotMessageSquare className="h-4 w-4" />
              {t("dashboard.quickNewBot")}
            </Link>
            <Link
              href="/conversations"
              className="inline-flex items-center gap-2 rounded-xl border border-default bg-surface-elevated px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-surface-muted"
            >
              <MessageSquare className="h-4 w-4 text-accent" />
              {t("dashboard.quickConversations")}
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 divide-y divide-subtle sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="px-5 py-4 sm:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-secondary">
            {t("dashboard.controlActiveBots")}
          </p>
          <p className="mt-1 text-2xl font-bold text-primary">{formatNumber(activeBots)}</p>
          <p className="mt-1 text-xs text-muted">
            {t("dashboard.controlActiveConversations", {
              count: formatNumber(activeConversations),
            })}
          </p>
        </div>
        <div className="px-5 py-4 sm:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-secondary">
            {t("dashboard.controlInboxOpen")}
          </p>
          <p className="mt-1 text-2xl font-bold text-primary">{formatNumber(openInbox)}</p>
          <p className="mt-1 text-xs text-muted">
            {t("dashboard.opsInboxPending", { count: pendingInbox })}
          </p>
        </div>
        <Link
          href={hasAlert ? "/supervisor" : "/metrics"}
          className="group px-5 py-4 transition-colors hover:bg-surface-muted/60 sm:px-6"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-secondary">
                {t("dashboard.controlSlaStatus")}
              </p>
              <p className="mt-1 text-2xl font-bold text-primary">
                {inboxSla?.enabled ? `${inboxSla.complianceRate ?? 0}%` : "—"}
              </p>
              <p className="mt-1 text-xs text-muted">
                {inboxSla?.enabled
                  ? t("dashboard.opsAtRisk", { count: slaAtRisk })
                  : t("dashboard.controlSlaDisabled")}
              </p>
            </div>
            {hasAlert ? (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warning/15 text-warning">
                <AlertTriangle className="h-4 w-4" />
              </div>
            ) : (
              <ArrowRight className="mt-1 h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
            )}
          </div>
        </Link>
      </div>
    </div>
  );
}
