"use client";

import { use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  X,
  Users,
  CheckCircle2,
  XCircle,
  Eye,
  Truck,
  Calendar,
  Tag,
} from "lucide-react";
import { useT } from "@/i18n/context";
import {
  useCampaign,
  useStartCampaign,
  usePauseCampaign,
  useResumeCampaign,
  useCancelCampaign,
} from "@/hooks/useCampaigns";
import { CampaignStatusBadge } from "@/components/campaigns/CampaignStatusBadge";
import { CampaignProgressBar } from "@/components/campaigns/CampaignProgressBar";
import { CampaignFunnelChart } from "@/components/campaigns/CampaignFunnelChart";
import { BulkJobFailures } from "@/components/bulk-send/BulkJobFailures";
import { DashboardPage } from "@/components/layout/DashboardPage";

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  colorClass: string;
}

function MetricCard({ icon, label, value, colorClass }: MetricCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
      <div className={`p-3 rounded-xl ${colorClass}`}>{icon}</div>
      <div>
        <p className="text-2xl font-bold text-gray-900 tabular-nums">{value.toLocaleString()}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  );
}

export default function CampaignDetailPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = use(params);
  const t = useT();

  const { data: campaign, isLoading, error } = useCampaign(campaignId);
  const start = useStartCampaign();
  const pause = usePauseCampaign();
  const resume = useResumeCampaign();
  const cancel = useCancelCampaign();

  const isActionPending =
    start.isPending || pause.isPending || resume.isPending || cancel.isPending;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        {t("common.loading")}
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <DashboardPage maxWidth="4xl">
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {t("campaigns.loadError")}
        </div>
      </DashboardPage>
    );
  }

  const canStart = campaign.status === "draft" || campaign.status === "scheduled";
  const canPause = campaign.status === "running";
  const canResume = campaign.status === "paused";
  const canCancel =
    campaign.status !== "completed" && campaign.status !== "cancelled";

  return (
    <DashboardPage maxWidth="4xl" className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/campaigns"
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900 truncate">{campaign.name}</h1>
            <CampaignStatusBadge status={campaign.status} />
          </div>
          <p className="text-sm text-gray-500">
            {t("campaigns.templateLabel")}: <span className="font-medium">{campaign.templateName}</span>
            {" · "}
            {t("campaigns.languageLabel")}: {campaign.language}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {canStart && (
            <button
              onClick={() => start.mutate(campaign.campaignId)}
              disabled={isActionPending}
              className="inline-flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium transition-colors"
            >
              <Play className="w-4 h-4" />
              {t("campaigns.start")}
            </button>
          )}
          {canPause && (
            <button
              onClick={() => pause.mutate(campaign.campaignId)}
              disabled={isActionPending}
              className="inline-flex items-center gap-2 px-3 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 text-sm font-medium transition-colors"
            >
              <Pause className="w-4 h-4" />
              {t("campaigns.pause")}
            </button>
          )}
          {canResume && (
            <button
              onClick={() => resume.mutate(campaign.campaignId)}
              disabled={isActionPending}
              className="inline-flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              {t("campaigns.resume")}
            </button>
          )}
          {canCancel && (
            <button
              onClick={() => {
                if (confirm(t("campaigns.confirmCancel", { name: campaign.name }))) {
                  cancel.mutate(campaign.campaignId);
                }
              }}
              disabled={isActionPending}
              className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm font-medium transition-colors"
            >
              <X className="w-4 h-4" />
              {t("campaigns.cancel")}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <MetricCard
          icon={<Users className="w-5 h-5 text-gray-600" />}
          label={t("campaigns.analytics.total")}
          value={campaign.total}
          colorClass="bg-gray-100"
        />
        <MetricCard
          icon={<CheckCircle2 className="w-5 h-5 text-blue-600" />}
          label={t("campaigns.analytics.sent")}
          value={campaign.sent}
          colorClass="bg-blue-50"
        />
        <MetricCard
          icon={<Truck className="w-5 h-5 text-green-600" />}
          label={t("campaigns.analytics.delivered")}
          value={campaign.deliveredCount}
          colorClass="bg-green-50"
        />
        <MetricCard
          icon={<Eye className="w-5 h-5 text-indigo-600" />}
          label={t("campaigns.analytics.read")}
          value={campaign.readCount}
          colorClass="bg-indigo-50"
        />
        <MetricCard
          icon={<XCircle className="w-5 h-5 text-red-600" />}
          label={t("campaigns.analytics.failed")}
          value={campaign.failed + campaign.deliveryFailed}
          colorClass="bg-red-50"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">{t("campaigns.progressTitle")}</h2>
          <CampaignProgressBar campaign={campaign} />
          <div className="text-xs text-gray-500">
            {campaign.sent + campaign.failed} / {campaign.total} {t("campaigns.processed")}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">{t("campaigns.funnelTitle")}</h2>
          <CampaignFunnelChart campaign={campaign} />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <h2 className="font-semibold text-gray-900">{t("campaigns.details")}</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <dt className="text-gray-500">{t("campaigns.createdAt")}</dt>
          <dd className="text-gray-900">{formatDate(campaign.createdAt)}</dd>
          {campaign.startedAt && (
            <>
              <dt className="text-gray-500">{t("campaigns.startedAt")}</dt>
              <dd className="text-gray-900">{formatDate(campaign.startedAt)}</dd>
            </>
          )}
          {campaign.completedAt && (
            <>
              <dt className="text-gray-500">{t("campaigns.completedAt")}</dt>
              <dd className="text-gray-900">{formatDate(campaign.completedAt)}</dd>
            </>
          )}
          {campaign.scheduledAt && (
            <>
              <dt className="text-gray-500 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {t("campaigns.scheduledAtLabel")}
              </dt>
              <dd className="text-gray-900">{formatDate(campaign.scheduledAt)}</dd>
            </>
          )}
          {campaign.segments.length > 0 && (
            <>
              <dt className="text-gray-500 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5" />
                {t("campaigns.segmentsLabel")}
              </dt>
              <dd className="flex flex-wrap gap-1">
                {campaign.segments.map((seg) => (
                  <span
                    key={seg}
                    className="bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded font-medium"
                  >
                    {seg}
                  </span>
                ))}
              </dd>
            </>
          )}
        </dl>
      </div>

      {(campaign.status === "completed" ||
        campaign.status === "failed" ||
        campaign.status === "running" ||
        campaign.status === "paused") && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">{t("campaigns.failuresTitle")}</h2>
          <BulkJobFailures
            jobId={campaign.campaignId}
            templateName={campaign.templateName}
            resource="campaign"
            enabled={true}
          />
        </div>
      )}
    </DashboardPage>
  );
}
