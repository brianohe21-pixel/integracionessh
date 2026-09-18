"use client";

import Link from "next/link";
import { Megaphone, Plus } from "lucide-react";
import { useMemo } from "react";
import { useCampaignList } from "@/hooks/useCampaigns";
import { useT } from "@/i18n/context";
import { CampaignMessagingList } from "@/components/campaigns/CampaignMessagingList";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";

export function SmsCampaignsTab() {
  const t = useT();
  const { data: campaigns = [], isLoading, error } = useCampaignList();
  const smsCampaigns = useMemo(
    () => campaigns.filter((campaign) => campaign.channel === "sms"),
    [campaigns]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-primary">{t("smsDashboard.campaigns.title")}</h2>
          <p className="mt-1 text-xs text-secondary">{t("smsDashboard.campaigns.subtitle")}</p>
        </div>
        <Link
          href="/campaigns/new"
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
        >
          <Plus className="h-4 w-4" />
          {t("smsDashboard.campaigns.create")}
        </Link>
      </div>

      {isLoading ? <Skeleton className="h-64 w-full" /> : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {t("campaigns.loadError")}
        </div>
      ) : null}

      {!isLoading && !error && smsCampaigns.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="h-8 w-8" />}
          title={t("smsDashboard.campaigns.empty")}
          description={t("smsDashboard.campaigns.emptyHint")}
          action={
            <Link
              href="/campaigns/new"
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
            >
              <Plus className="h-4 w-4" />
              {t("smsDashboard.campaigns.create")}
            </Link>
          }
        />
      ) : null}

      {!isLoading && !error && smsCampaigns.length > 0 ? (
        <CampaignMessagingList campaigns={smsCampaigns} />
      ) : null}
    </div>
  );
}
