"use client";

import Link from "next/link";
import { Plus, Megaphone, Calendar, Tag } from "lucide-react";
import { useT } from "@/i18n/context";
import { useCampaignList } from "@/hooks/useCampaigns";
import { CampaignStatusBadge } from "@/components/campaigns/CampaignStatusBadge";
import { CampaignProgressBar } from "@/components/campaigns/CampaignProgressBar";
import { CampaignManagementActions } from "@/components/campaigns/CampaignManagementActions";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CampaignsPage() {
  const t = useT();
  const { data: campaigns = [], isLoading, error } = useCampaignList();

  return (
    <DashboardPage maxWidth="6xl" className="space-y-6">
      <PageHeader
        title={t("campaigns.title")}
        subtitle={t("campaigns.subtitle")}
        actions={
          <Link
            href="/campaigns/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            {t("campaigns.create")}
          </Link>
        }
      />

      {isLoading && (
        <div className="text-center py-12 text-muted">{t("common.loading")}</div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {t("campaigns.loadError")}
        </div>
      )}

      {!isLoading && campaigns.length === 0 && (
        <div className="text-center py-20 space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-surface-muted">
            <Megaphone className="w-8 h-8 text-muted" />
          </div>
          <div>
            <p className="font-medium text-primary">{t("campaigns.empty")}</p>
            <p className="text-sm text-secondary mt-1">{t("campaigns.emptyHint")}</p>
          </div>
          <Link
            href="/campaigns/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            {t("campaigns.create")}
          </Link>
        </div>
      )}

      {campaigns.length > 0 && (
        <div className="space-y-3">
          {campaigns.map((campaign) => (
            <div
              key={campaign.campaignId}
              className="bg-surface-elevated rounded-xl border border-default p-5 hover:border-accent/30 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/campaigns/${campaign.campaignId}`}
                      className="font-semibold text-primary hover:text-accent transition-colors truncate"
                    >
                      {campaign.name}
                    </Link>
                    <CampaignStatusBadge status={campaign.status} />
                  </div>

                  <p className="text-sm text-secondary mt-0.5">
                    {t("campaigns.templateLabel")}: <span className="font-medium text-secondary">{campaign.templateName}</span>
                  </p>

                  {campaign.segments.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <Tag className="w-3.5 h-3.5 text-muted flex-shrink-0" />
                      {campaign.segments.map((seg) => (
                        <span key={seg} className="text-xs bg-surface-muted text-secondary px-1.5 py-0.5 rounded">
                          {seg}
                        </span>
                      ))}
                    </div>
                  )}

                  {campaign.scheduledAt && campaign.status === "scheduled" && (
                    <div className="flex items-center gap-1 mt-1.5 text-xs text-blue-600">
                      <Calendar className="w-3.5 h-3.5" />
                      {t("campaigns.scheduledFor")}: {formatDate(campaign.scheduledAt)}
                    </div>
                  )}

                  <div className="mt-3">
                    <CampaignProgressBar campaign={campaign} />
                  </div>

                  <div className="flex items-center gap-4 mt-2 text-xs text-muted">
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
                    <span className="ml-auto">{formatDate(campaign.createdAt)}</span>
                  </div>
                </div>

                <div className="flex-shrink-0">
                  <CampaignManagementActions campaign={campaign} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardPage>
  );
}
