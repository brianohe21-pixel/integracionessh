"use client";

import Link from "next/link";
import { Plus, BotMessageSquare } from "lucide-react";
import { useBots } from "@/hooks/useBots";
import { BotCard } from "@/components/bots/BotCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { useT } from "@/i18n/context";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { OnboardingBanner } from "@/components/onboarding/OnboardingBanner";
import { SalesSummaryCard } from "@/components/metrics/SalesSummaryCard";
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
              <Link data-tour="bots-create" href="/bots/new">
                <Button size="md">
                  <Plus className="h-4 w-4" />
                  {t("bots.newBot")}
                </Button>
              </Link>
            </ContextualHint>
          }
        />
      </div>

      <TourPageSuggestion tourId="bots" />

      <div data-tour="bots-onboarding">
        <OnboardingBanner />
      </div>

      <SalesSummaryCard />

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {error && (
        <Alert variant="danger" title={t("bots.loadError")}>
          <p className="break-words text-xs opacity-80">{error.message}</p>
        </Alert>
      )}

      {!isLoading && !error && bots?.length === 0 && (
        <div data-tour="bots-grid">
          <EmptyState
            icon={<BotMessageSquare className="h-6 w-6" />}
            title={t("bots.emptyTitle")}
            description={t("bots.emptyDescription")}
            action={
              <Link href="/bots/new">
                <Button>
                  <Plus className="h-4 w-4" />
                  {t("bots.createFirst")}
                </Button>
              </Link>
            }
          />
        </div>
      )}

      {!isLoading && bots && bots.length > 0 && (
        <div data-tour="bots-grid" className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {bots.map((bot) => (
            <BotCard key={bot.botId} bot={bot} />
          ))}
        </div>
      )}
    </DashboardPage>
  );
}
