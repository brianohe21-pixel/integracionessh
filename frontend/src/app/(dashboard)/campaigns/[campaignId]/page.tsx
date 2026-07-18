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
import { TemplateMessagePreview } from "@/components/templates/TemplateMessagePreview";
import { CampaignQualityAlert } from "@/components/campaigns/CampaignQualityAlert";
import { useTemplates } from "@/hooks/useTemplates";
import { useWhatsAppQualityGuard } from "@/hooks/useWhatsAppQualityGuard";
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
    <div className="bg-surface-elevated rounded-xl border border-default p-5 flex items-center gap-4">
      <div className={`p-3 rounded-xl ${colorClass}`}>{icon}</div>
      <div>
        <p className="text-2xl font-bold text-primary tabular-nums">{value.toLocaleString()}</p>
        <p className="text-sm text-secondary">{label}</p>
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
  const { data: templates = [] } = useTemplates(campaign?.botId);
  const campaignTemplate = templates.find(
    (tmpl) => tmpl.name === campaign?.templateName && tmpl.language === campaign?.language
  );
  const start = useStartCampaign();
  const pause = usePauseCampaign();
  const resume = useResumeCampaign();
  const cancel = useCancelCampaign();
  const { assessment, phone, isLoading: qualityLoading, confirmStart } = useWhatsAppQualityGuard(
    campaign?.botId
  );

  const isActionPending =
    start.isPending || pause.isPending || resume.isPending || cancel.isPending;

  const startBlocked = assessment.risk === "block";

  async function handleStart() {
    if (startBlocked) {
      window.alert(t("campaigns.qualityStartBlocked"));
      return;
    }
    const confirmed = await confirmStart("start");
    if (!confirmed) return;
    start.mutate(campaignId);
  }

  async function handleResume() {
    if (startBlocked) {
      window.alert(t("campaigns.qualityStartBlocked"));
      return;
    }
    const confirmed = await confirmStart("resume");
    if (!confirmed) return;
    resume.mutate(campaignId);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted">
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
          className="p-2 rounded-lg text-secondary hover:bg-surface-muted hover:text-secondary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-primary truncate">{campaign.name}</h1>
            <CampaignStatusBadge status={campaign.status} />
          </div>
          <p className="text-sm text-secondary">
            {t("campaigns.templateLabel")}: <span className="font-medium">{campaign.templateName}</span>
            {" · "}
            {t("campaigns.languageLabel")}: {campaign.language}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {canStart && (
            <button
              onClick={handleStart}
              disabled={isActionPending || startBlocked || qualityLoading}
              title={startBlocked ? t("campaigns.qualityStartBlocked") : undefined}
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
              onClick={handleResume}
              disabled={isActionPending || startBlocked || qualityLoading}
              title={startBlocked ? t("campaigns.qualityStartBlocked") : undefined}
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
              className="inline-flex items-center gap-2 px-3 py-2 border border-default text-secondary rounded-lg hover:bg-surface disabled:opacity-50 text-sm font-medium transition-colors"
            >
              <X className="w-4 h-4" />
              {t("campaigns.cancel")}
            </button>
          )}
        </div>
      </div>

      {(canStart || canResume) && (
        <CampaignQualityAlert
          phone={phone}
          assessment={assessment}
          isLoading={qualityLoading}
        />
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <MetricCard
          icon={<Users className="w-5 h-5 text-secondary" />}
          label={t("campaigns.analytics.total")}
          value={campaign.total}
          colorClass="bg-surface-muted"
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
          icon={<Eye className="w-5 h-5 text-accent" />}
          label={t("campaigns.analytics.read")}
          value={campaign.readCount}
          colorClass="bg-accent-muted"
        />
        <MetricCard
          icon={<XCircle className="w-5 h-5 text-red-600" />}
          label={t("campaigns.analytics.failed")}
          value={campaign.failed + campaign.deliveryFailed}
          colorClass="bg-red-50"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-surface-elevated rounded-xl border border-default p-5 space-y-4">
          <h2 className="font-semibold text-primary">{t("campaigns.progressTitle")}</h2>
          <CampaignProgressBar campaign={campaign} />
          <div className="text-xs text-secondary">
            {campaign.sent + campaign.failed} / {campaign.total} {t("campaigns.processed")}
          </div>
        </div>

        <div className="bg-surface-elevated rounded-xl border border-default p-5 space-y-4">
          <h2 className="font-semibold text-primary">{t("campaigns.funnelTitle")}</h2>
          <CampaignFunnelChart campaign={campaign} />
        </div>
      </div>

      <div className="bg-surface-elevated rounded-xl border border-default p-5 space-y-3">
        <h2 className="font-semibold text-primary">{t("campaigns.details")}</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <dt className="text-secondary">{t("campaigns.createdAt")}</dt>
          <dd className="text-primary">{formatDate(campaign.createdAt)}</dd>
          {campaign.startedAt && (
            <>
              <dt className="text-secondary">{t("campaigns.startedAt")}</dt>
              <dd className="text-primary">{formatDate(campaign.startedAt)}</dd>
            </>
          )}
          {campaign.completedAt && (
            <>
              <dt className="text-secondary">{t("campaigns.completedAt")}</dt>
              <dd className="text-primary">{formatDate(campaign.completedAt)}</dd>
            </>
          )}
          {campaign.scheduledAt && (
            <>
              <dt className="text-secondary flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {t("campaigns.scheduledAtLabel")}
              </dt>
              <dd className="text-primary">{formatDate(campaign.scheduledAt)}</dd>
            </>
          )}
          {campaign.segments.length > 0 && (
            <>
              <dt className="text-secondary flex items-center gap-1">
                <Tag className="w-3.5 h-3.5" />
                {t("campaigns.segmentsLabel")}
              </dt>
              <dd className="flex flex-wrap gap-1">
                {campaign.segments.map((seg) => (
                  <span
                    key={seg}
                    className="bg-accent-muted text-accent text-xs px-2 py-0.5 rounded font-medium"
                  >
                    {seg}
                  </span>
                ))}
              </dd>
            </>
          )}
        </dl>
      </div>

      {campaignTemplate && (
        <div className="bg-surface-elevated rounded-xl border border-default p-5">
          <h2 className="font-semibold text-primary mb-4">{t("bulkSend.preview")}</h2>
          <TemplateMessagePreview template={campaignTemplate} />
        </div>
      )}

      {(campaign.status === "completed" ||
        campaign.status === "failed" ||
        campaign.status === "running" ||
        campaign.status === "paused") && (
        <div className="bg-surface-elevated rounded-xl border border-default p-5">
          <h2 className="font-semibold text-primary mb-4">{t("campaigns.failuresTitle")}</h2>
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
