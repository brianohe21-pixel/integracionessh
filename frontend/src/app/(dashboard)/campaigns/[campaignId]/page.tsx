"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Users,
  CheckCircle2,
  XCircle,
  Eye,
  Truck,
  Calendar,
  Tag,
  Download,
} from "lucide-react";
import { useT } from "@/i18n/context";
import { useCampaign } from "@/hooks/useCampaigns";
import { useBot } from "@/hooks/useBots";
import { useCampaignExport } from "@/hooks/useCampaignExport";
import { CampaignStatusBadge } from "@/components/campaigns/CampaignStatusBadge";
import { CampaignProgressBar } from "@/components/campaigns/CampaignProgressBar";
import { CampaignFunnelChart } from "@/components/campaigns/CampaignFunnelChart";
import { CampaignRealtimeMetricsPanel } from "@/components/campaigns/CampaignRealtimeMetricsPanel";
import { CampaignManagementActions } from "@/components/campaigns/CampaignManagementActions";
import { formatBatchDelay } from "@/components/campaigns/CampaignBatchSettings";
import { BulkJobFailures } from "@/components/bulk-send/BulkJobFailures";
import { TemplateMessagePreview } from "@/components/templates/TemplateMessagePreview";
import { SmsTemplatePreview } from "@/components/templates/SmsTemplatePreview";
import { isSmsTemplate } from "@/types";
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
  const router = useRouter();

  const { data: campaign, isLoading, error } = useCampaign(campaignId);
  const { data: campaignAgent } = useBot(campaign?.botId ?? "");
  const { exportSendRecords, isExporting, exportError, canExport } = useCampaignExport(campaign);
  const campaignChannel = campaign?.channel ?? "whatsapp";
  const showSmsDeliveryMetrics = campaignChannel === "sms" && Boolean(campaign?.requestDlr);
  const { data: templates = [] } = useTemplates(campaign?.botId, campaignChannel);
  const campaignTemplate = templates.find(
    (tmpl) => tmpl.name === campaign?.templateName && tmpl.language === campaign?.language
  );
  const { assessment, phone, isLoading: qualityLoading } =
    useWhatsAppQualityGuard(campaign?.botId, campaignChannel === "whatsapp");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted">
        {t("common.loading")}
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <DashboardPage>
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {t("campaigns.loadError")}
        </div>
      </DashboardPage>
    );
  }

  const canStart = campaign.status === "draft" || campaign.status === "scheduled";
  const canResume = campaign.status === "paused";

  return (
    <>
    <DashboardPage className="space-y-6">
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
            {t("outreach.channel")}:{" "}
            <span className="font-medium">
              {campaignChannel === "sms" ? t("outreach.channelSms") : t("outreach.channelWhatsapp")}
            </span>
            {" · "}
            {t("outreach.agent")}:{" "}
            <span className="font-medium">{campaignAgent?.name ?? campaign.botId}</span>
            {" · "}
            {t("campaigns.templateLabel")}: <span className="font-medium">{campaign.templateName}</span>
            {" · "}
            {t("campaigns.languageLabel")}: {campaign.language}
          </p>
        </div>

        <CampaignManagementActions
          campaign={campaign}
          variant="detail"
          onArchived={() => router.push("/campaigns")}
          onCloned={(clonedId) => router.push(`/campaigns/${clonedId}/edit`)}
        />
      </div>

      {campaignChannel === "whatsapp" && (canStart || canResume) && (
        <CampaignQualityAlert
          phone={phone}
          assessment={assessment}
          isLoading={qualityLoading}
        />
      )}

      <div className={`grid grid-cols-2 md:grid-cols-3 ${campaignChannel === "sms" && !showSmsDeliveryMetrics ? "lg:grid-cols-3" : campaignChannel === "sms" ? "lg:grid-cols-4" : "lg:grid-cols-5"} gap-3`}>
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
        {(campaignChannel !== "sms" || showSmsDeliveryMetrics) && (
          <>
            <MetricCard
              icon={<Truck className="w-5 h-5 text-green-600" />}
              label={t("campaigns.analytics.delivered")}
              value={campaign.deliveredCount}
              colorClass="bg-green-50"
            />
            {campaignChannel !== "sms" && (
              <MetricCard
                icon={<Eye className="w-5 h-5 text-accent" />}
                label={t("campaigns.analytics.read")}
                value={campaign.readCount}
                colorClass="bg-accent-muted"
              />
            )}
          </>
        )}
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
          <CampaignFunnelChart
            campaign={campaign}
            showDeliveryMetrics={campaignChannel !== "sms" || showSmsDeliveryMetrics}
            showReadMetrics={campaignChannel !== "sms"}
          />
        </div>
      </div>

      <CampaignRealtimeMetricsPanel campaign={campaign} />

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
          {campaign.batchConfig && (
            <>
              <dt className="text-secondary">{t("campaigns.batch.detailSize")}</dt>
              <dd className="text-primary">{campaign.batchConfig.size}</dd>
              <dt className="text-secondary">{t("campaigns.batch.detailDelay")}</dt>
              <dd className="text-primary">
                {formatBatchDelay(campaign.batchConfig.delaySeconds, t)}
              </dd>
              {campaign.batchesDispatched !== undefined && campaign.batchesDispatched > 0 && (
                <>
                  <dt className="text-secondary">{t("campaigns.batch.detailBatchesDispatched")}</dt>
                  <dd className="text-primary">{campaign.batchesDispatched}</dd>
                </>
              )}
              {campaign.currentBatch !== undefined && campaign.currentBatch > 0 && (
                <>
                  <dt className="text-secondary">{t("campaigns.batch.detailCurrentBatch")}</dt>
                  <dd className="text-primary">{campaign.currentBatch}</dd>
                </>
              )}
              {campaign.nextBatchAt && campaign.status === "running" && (
                <>
                  <dt className="text-secondary">{t("campaigns.batch.detailNextBatch")}</dt>
                  <dd className="text-primary">{formatDate(campaign.nextBatchAt)}</dd>
                </>
              )}
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

      {campaignTemplate && isSmsTemplate(campaignTemplate) && (
        <div className="bg-surface-elevated rounded-xl border border-default p-5">
          <h2 className="font-semibold text-primary mb-4">{t("bulkSend.preview")}</h2>
          <SmsTemplatePreview template={campaignTemplate} />
        </div>
      )}

      {campaignTemplate && !isSmsTemplate(campaignTemplate) && (
        <div className="bg-surface-elevated rounded-xl border border-default p-5">
          <h2 className="font-semibold text-primary mb-4">{t("bulkSend.preview")}</h2>
          <TemplateMessagePreview template={campaignTemplate} />
        </div>
      )}

      <div className="bg-surface-elevated rounded-xl border border-default p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-primary">{t("campaigns.sendRecordsTitle")}</h2>
          <button
            type="button"
            onClick={() => void exportSendRecords()}
            disabled={!canExport || isExporting}
            title={!canExport ? t("campaigns.exportSendRecordsDisabledDraft") : undefined}
            className="inline-flex items-center gap-2 rounded-lg border border-default bg-surface-elevated px-3 py-2 text-sm font-medium text-primary disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {isExporting ? t("campaigns.exportingSendRecords") : t("campaigns.exportSendRecords")}
          </button>
        </div>
        {exportError && (
          <p className="mt-3 text-sm text-red-600">{exportError}</p>
        )}
      </div>

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
    </>
  );
}
