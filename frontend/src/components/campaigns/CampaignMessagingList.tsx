"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Megaphone, Plus, Calendar, Tag } from "lucide-react";
import { useT } from "@/i18n/context";
import { useBots } from "@/hooks/useBots";
import { CampaignStatusBadge } from "@/components/campaigns/CampaignStatusBadge";
import { CampaignProgressBar } from "@/components/campaigns/CampaignProgressBar";
import { CampaignManagementActions } from "@/components/campaigns/CampaignManagementActions";
import { SearchInput } from "@/components/ui/SearchInput";
import type { Campaign, CampaignStatus, OutreachChannel } from "@/types";

const PAGE_SIZE = 10;

const STATUSES: CampaignStatus[] = [
  "draft",
  "scheduled",
  "running",
  "paused",
  "completed",
  "failed",
  "cancelled",
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface CampaignMessagingListProps {
  campaigns: Campaign[];
}

export function CampaignMessagingList({ campaigns }: CampaignMessagingListProps) {
  const t = useT();
  const { data: bots } = useBots();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | CampaignStatus>("");
  const [channelFilter, setChannelFilter] = useState<"" | OutreachChannel>("");
  const [botFilter, setBotFilter] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, channelFilter, botFilter]);

  const filteredCampaigns = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return [...campaigns]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .filter((campaign) => {
        if (statusFilter && campaign.status !== statusFilter) return false;

        if (channelFilter) {
          const channel = campaign.channel ?? "whatsapp";
          if (channel !== channelFilter) return false;
        }

        if (botFilter && campaign.botId !== botFilter) return false;

        if (!normalizedQuery) return true;

        return (
          campaign.name.toLowerCase().includes(normalizedQuery) ||
          campaign.templateName.toLowerCase().includes(normalizedQuery) ||
          campaign.segments.some((segment) => segment.toLowerCase().includes(normalizedQuery))
        );
      });
  }, [campaigns, query, statusFilter, channelFilter, botFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredCampaigns.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = filteredCampaigns.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(safePage * PAGE_SIZE, filteredCampaigns.length);
  const paginatedCampaigns = filteredCampaigns.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  if (campaigns.length === 0) {
    return (
      <div className="space-y-4 py-20 text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-surface-muted">
          <Megaphone className="h-8 w-8 text-muted" />
        </div>
        <div>
          <p className="font-medium text-primary">{t("campaigns.empty")}</p>
          <p className="mt-1 text-sm text-secondary">{t("campaigns.emptyHint")}</p>
        </div>
        <Link
          href="/campaigns/new"
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
        >
          <Plus className="h-4 w-4" />
          {t("campaigns.create")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SearchInput
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onClear={() => setQuery("")}
          placeholder={t("campaigns.searchPlaceholder")}
          className="w-full lg:max-w-md"
        />
        <div className="flex flex-wrap gap-2">
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "" | CampaignStatus)}
            className="rounded-lg border border-default bg-surface-elevated px-3 py-2 text-sm text-primary"
          >
            <option value="">{t("campaigns.filterAllStatus")}</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(`campaigns.status.${status}`)}
              </option>
            ))}
          </select>
          <select
            value={channelFilter}
            onChange={(event) => setChannelFilter(event.target.value as "" | OutreachChannel)}
            className="rounded-lg border border-default bg-surface-elevated px-3 py-2 text-sm text-primary"
          >
            <option value="">{t("campaigns.filterAllChannels")}</option>
            <option value="whatsapp">{t("campaigns.channelWhatsapp")}</option>
            <option value="sms">{t("campaigns.channelSms")}</option>
          </select>
          <select
            value={botFilter}
            onChange={(event) => setBotFilter(event.target.value)}
            className="rounded-lg border border-default bg-surface-elevated px-3 py-2 text-sm text-primary"
          >
            <option value="">{t("automations.allBots")}</option>
            {(bots ?? []).map((bot) => (
              <option key={bot.botId} value={bot.botId}>
                {bot.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filteredCampaigns.length === 0 ? (
        <div className="space-y-2 rounded-xl border border-default bg-surface-elevated py-16 text-center">
          <p className="font-medium text-primary">{t("campaigns.emptySearch")}</p>
          <p className="text-sm text-secondary">{t("campaigns.emptySearchHint")}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {paginatedCampaigns.map((campaign) => (
              <div
                key={campaign.campaignId}
                className="flex h-full flex-col rounded-xl border border-default bg-surface-elevated p-5 transition-all hover:border-accent/30 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/campaigns/${campaign.campaignId}`}
                        className="truncate font-semibold text-primary transition-colors hover:text-accent"
                      >
                        {campaign.name}
                      </Link>
                      <CampaignStatusBadge status={campaign.status} />
                    </div>

                    <p className="mt-0.5 text-sm text-secondary">
                      {t("campaigns.templateLabel")}:{" "}
                      <span className="font-medium text-secondary">{campaign.templateName}</span>
                    </p>

                    {campaign.segments.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Tag className="h-3.5 w-3.5 flex-shrink-0 text-muted" />
                        {campaign.segments.map((seg) => (
                          <span
                            key={seg}
                            className="rounded bg-surface-muted px-1.5 py-0.5 text-xs text-secondary"
                          >
                            {seg}
                          </span>
                        ))}
                      </div>
                    )}

                    {campaign.scheduledAt && campaign.status === "scheduled" && (
                      <div className="mt-1.5 flex items-center gap-1 text-xs text-blue-600">
                        <Calendar className="h-3.5 w-3.5" />
                        {t("campaigns.scheduledFor")}: {formatDate(campaign.scheduledAt)}
                      </div>
                    )}

                    <div className="mt-3">
                      <CampaignProgressBar campaign={campaign} />
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                      <span>{t("campaigns.totalRecipients", { count: campaign.total })}</span>
                      {campaign.deliveredCount > 0 && (
                        <span className="text-green-600">
                          {t("campaigns.analytics.delivered")}: {campaign.deliveredCount}
                        </span>
                      )}
                      {campaign.readCount > 0 && (
                        <span className="text-accent">
                          {t("campaigns.analytics.read")}: {campaign.readCount}
                        </span>
                      )}
                      <span className="w-full sm:ml-auto sm:w-auto">{formatDate(campaign.createdAt)}</span>
                    </div>
                  </div>

                  <div className="flex-shrink-0">
                    <CampaignManagementActions campaign={campaign} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredCampaigns.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-default pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-secondary">
                {t("campaigns.showingRange", {
                  from: pageStart,
                  to: pageEnd,
                  total: filteredCampaigns.length,
                })}
              </p>
              {totalPages > 1 ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={safePage <= 1}
                    className="inline-flex items-center gap-1 rounded-lg border border-default px-3 py-1.5 text-sm text-primary transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    {t("campaigns.previousPage")}
                  </button>
                  <span className="px-2 text-sm text-secondary">
                    {t("campaigns.pageOf", { page: safePage, total: totalPages })}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                    disabled={safePage >= totalPages}
                    className="inline-flex items-center gap-1 rounded-lg border border-default px-3 py-1.5 text-sm text-primary transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t("campaigns.nextPage")}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </>
      )}
    </div>
  );
}
