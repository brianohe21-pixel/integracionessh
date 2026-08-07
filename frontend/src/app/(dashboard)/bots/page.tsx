"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, BotMessageSquare } from "lucide-react";
import { useBots } from "@/hooks/useBots";
import { BotCard } from "@/components/bots/BotCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/SearchInput";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { useT } from "@/i18n/context";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { OnboardingBanner } from "@/components/onboarding/OnboardingBanner";
import { SalesSummaryCard } from "@/components/metrics/SalesSummaryCard";
import { ContextualHint } from "@/components/help-center/ContextualHint";
import { TourPageSuggestion } from "@/components/help-center/TourList";

type StatusFilter = "all" | "active" | "inactive";

export default function BotsPage() {
  const t = useT();
  const { data: bots, isLoading, error } = useBots();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filteredBots = useMemo(() => {
    if (!bots) return [];
    const normalizedQuery = query.trim().toLowerCase();

    return bots.filter((bot) => {
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && bot.status === "active") ||
        (statusFilter === "inactive" && bot.status === "inactive");

      if (!matchesStatus) return false;
      if (!normalizedQuery) return true;

      return (
        bot.name.toLowerCase().includes(normalizedQuery) ||
        (bot.systemPrompt?.toLowerCase().includes(normalizedQuery) ?? false) ||
        (bot.webhookUrl?.toLowerCase().includes(normalizedQuery) ?? false) ||
        bot.phoneNumberId.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [bots, query, statusFilter]);

  const statusFilters: { id: StatusFilter; label: string }[] = [
    { id: "all", label: t("bots.filterAll") },
    { id: "active", label: t("common.active") },
    { id: "inactive", label: t("common.inactive") },
  ];

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

      {!isLoading && !error && (bots?.length ?? 0) > 0 ? (
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SearchInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onClear={() => setQuery("")}
            placeholder={t("bots.searchPlaceholder")}
            className="w-full sm:max-w-md"
          />
          <div className="flex flex-wrap gap-2">
            {statusFilters.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setStatusFilter(filter.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  statusFilter === filter.id
                    ? "bg-accent text-white"
                    : "bg-surface-muted text-secondary hover:text-primary"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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

      {!isLoading && bots && bots.length > 0 && filteredBots.length === 0 ? (
        <EmptyState
          icon={<BotMessageSquare className="h-6 w-6" />}
          title={t("bots.emptySearchTitle")}
          description={t("bots.emptySearchDescription")}
        />
      ) : null}

      {!isLoading && filteredBots.length > 0 && (
        <div data-tour="bots-grid" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredBots.map((bot) => (
            <BotCard key={bot.botId} bot={bot} />
          ))}
        </div>
      )}
    </DashboardPage>
  );
}
