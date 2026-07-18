"use client";

import Link from "next/link";
import { Plus, BotMessageSquare } from "lucide-react";
import { useBots } from "@/hooks/useBots";
import { BotCard } from "@/components/bots/BotCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { useT } from "@/i18n/context";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { OnboardingBanner } from "@/components/onboarding/OnboardingBanner";
import { ContextualHint } from "@/components/help-center/ContextualHint";
import { TourPageSuggestion } from "@/components/help-center/TourList";

export default function BotsPage() {
  const t = useT();
  const { data: bots, isLoading, error } = useBots();

  return (
    <DashboardPage>
      <div data-tour="bots-header">
        <PageHeader
          title={t("bots.title")}
          subtitle={t("bots.subtitle")}
          actions={
            <ContextualHint hintId="bots-create" content={t("helpCenter.hints.botsCreate")}>
              <Link
                data-tour="bots-create"
                href="/bots/new"
                className="flex items-center gap-2 px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover transition-colors"
              >
                <Plus className="w-4 h-4" />
                {t("bots.newBot")}
              </Link>
            </ContextualHint>
          }
        />
      </div>

      <TourPageSuggestion tourId="bots" />

      <div data-tour="bots-onboarding">
        <OnboardingBanner />
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-surface-elevated rounded-xl border border-default p-5 animate-pulse">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gray-200 rounded-xl" />
                <div className="space-y-1.5">
                  <div className="h-3.5 w-28 bg-gray-200 rounded" />
                  <div className="h-3 w-20 bg-gray-200 rounded" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-3 bg-gray-200 rounded w-full" />
                <div className="h-3 bg-gray-200 rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-600 font-medium">{t("bots.loadError")}</p>
          <p className="text-xs text-red-500 mt-1 break-words">{error.message}</p>
        </div>
      )}

      {!isLoading && !error && bots?.length === 0 && (
        <div data-tour="bots-grid">
          <EmptyState
            icon={<BotMessageSquare className="w-6 h-6" />}
            title={t("bots.emptyTitle")}
            description={t("bots.emptyDescription")}
            action={
              <Link
                href="/bots/new"
                className="flex items-center gap-2 px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover transition-colors"
              >
                <Plus className="w-4 h-4" />
                {t("bots.createFirst")}
              </Link>
            }
          />
        </div>
      )}

      {!isLoading && bots && bots.length > 0 && (
        <div data-tour="bots-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bots.map((bot) => (
            <BotCard key={bot.botId} bot={bot} />
          ))}
        </div>
      )}
    </DashboardPage>
  );
}
