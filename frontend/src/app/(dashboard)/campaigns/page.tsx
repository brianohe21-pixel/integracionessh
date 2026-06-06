"use client";

import Link from "next/link";
import { Plus, Megaphone, Play, Pause, RotateCcw, X, Calendar, Tag } from "lucide-react";
import { useT } from "@/i18n/context";
import { useCampaignList, useStartCampaign, usePauseCampaign, useResumeCampaign, useCancelCampaign } from "@/hooks/useCampaigns";
import { CampaignStatusBadge } from "@/components/campaigns/CampaignStatusBadge";
import { CampaignProgressBar } from "@/components/campaigns/CampaignProgressBar";
import type { Campaign, CampaignStatus } from "@/types";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CampaignActions({ campaign }: { campaign: Campaign }) {
  const t = useT();
  const start = useStartCampaign();
  const pause = usePauseCampaign();
  const resume = useResumeCampaign();
  const cancel = useCancelCampaign();

  const isPending = start.isPending || pause.isPending || resume.isPending || cancel.isPending;

  return (
    <div className="flex items-center gap-1">
      {(campaign.status === "draft" || campaign.status === "scheduled") && (
        <button
          onClick={() => start.mutate(campaign.campaignId)}
          disabled={isPending}
          title={t("campaigns.start")}
          className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 disabled:opacity-40 transition-colors"
        >
          <Play className="w-4 h-4" />
        </button>
      )}
      {campaign.status === "running" && (
        <button
          onClick={() => pause.mutate(campaign.campaignId)}
          disabled={isPending}
          title={t("campaigns.pause")}
          className="p-1.5 rounded-lg text-yellow-600 hover:bg-yellow-50 disabled:opacity-40 transition-colors"
        >
          <Pause className="w-4 h-4" />
        </button>
      )}
      {campaign.status === "paused" && (
        <button
          onClick={() => resume.mutate(campaign.campaignId)}
          disabled={isPending}
          title={t("campaigns.resume")}
          className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 disabled:opacity-40 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      )}
      {campaign.status !== "completed" && campaign.status !== "cancelled" && (
        <button
          onClick={() => {
            if (confirm(t("campaigns.confirmCancel", { name: campaign.name }))) {
              cancel.mutate(campaign.campaignId);
            }
          }}
          disabled={isPending}
          title={t("campaigns.cancel")}
          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

const STATUS_FILTERS: Array<{ value: CampaignStatus | "all"; label: string }> = [
  { value: "all", label: "all" },
  { value: "draft", label: "draft" },
  { value: "scheduled", label: "scheduled" },
  { value: "running", label: "running" },
  { value: "paused", label: "paused" },
  { value: "completed", label: "completed" },
  { value: "cancelled", label: "cancelled" },
];

export default function CampaignsPage() {
  const t = useT();
  const { data: campaigns = [], isLoading, error } = useCampaignList();

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("campaigns.title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("campaigns.subtitle")}</p>
        </div>
        <Link
          href="/campaigns/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          {t("campaigns.create")}
        </Link>
      </div>

      {isLoading && (
        <div className="text-center py-12 text-gray-400">{t("common.loading")}</div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {t("campaigns.loadError")}
        </div>
      )}

      {!isLoading && campaigns.length === 0 && (
        <div className="text-center py-20 space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100">
            <Megaphone className="w-8 h-8 text-gray-400" />
          </div>
          <div>
            <p className="font-medium text-gray-900">{t("campaigns.empty")}</p>
            <p className="text-sm text-gray-500 mt-1">{t("campaigns.emptyHint")}</p>
          </div>
          <Link
            href="/campaigns/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
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
              className="bg-white rounded-xl border border-gray-200 p-5 hover:border-indigo-200 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/campaigns/${campaign.campaignId}`}
                      className="font-semibold text-gray-900 hover:text-indigo-600 transition-colors truncate"
                    >
                      {campaign.name}
                    </Link>
                    <CampaignStatusBadge status={campaign.status} />
                  </div>

                  <p className="text-sm text-gray-500 mt-0.5">
                    {t("campaigns.templateLabel")}: <span className="font-medium text-gray-700">{campaign.templateName}</span>
                  </p>

                  {campaign.segments.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <Tag className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      {campaign.segments.map((seg) => (
                        <span key={seg} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
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

                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                    <span>{t("campaigns.totalRecipients", { count: campaign.total })}</span>
                    {campaign.deliveredCount > 0 && (
                      <span className="text-green-600">
                        {t("campaigns.analytics.delivered")}: {campaign.deliveredCount}
                      </span>
                    )}
                    {campaign.readCount > 0 && (
                      <span className="text-indigo-600">
                        {t("campaigns.analytics.read")}: {campaign.readCount}
                      </span>
                    )}
                    <span className="ml-auto">{formatDate(campaign.createdAt)}</span>
                  </div>
                </div>

                <div className="flex-shrink-0">
                  <CampaignActions campaign={campaign} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
