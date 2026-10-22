import { downloadBillingReportPdf } from "@/lib/billing-report-pdf";
import type { Campaign, CampaignMetrics } from "@/types";

function slugifyName(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "campaign";
}

function formatDate(iso?: string): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "-";
  return `${(value * 100).toFixed(1)}%`;
}

export function buildCampaignResultsPdfFilename(campaign: Campaign): string {
  const channel = campaign.channel ?? "whatsapp";
  const date = new Date().toISOString().slice(0, 10);
  return `campaign-${channel}-${slugifyName(campaign.name)}-${date}.pdf`;
}

export async function downloadCampaignResultsPdf(params: {
  campaign: Campaign;
  metrics?: CampaignMetrics | null;
  labels: {
    title: string;
    metric: string;
    value: string;
    channel: string;
    status: string;
    template: string;
    language: string;
    createdAt: string;
    startedAt: string;
    completedAt: string;
    total: string;
    sent: string;
    delivered: string;
    read: string;
    failed: string;
    replies: string;
    replyRate: string;
    funnelSent: string;
    funnelReplied: string;
    funnelHandoff: string;
    funnelAdvisorResponded: string;
    funnelConverted: string;
  };
}): Promise<void> {
  const { campaign, metrics, labels } = params;
  const channel = campaign.channel ?? "whatsapp";
  const failed = campaign.failed + campaign.deliveryFailed;

  const rows: string[][] = [
    [labels.channel, channel],
    [labels.status, campaign.status],
    [labels.template, campaign.templateName],
    [labels.language, campaign.language],
    [labels.createdAt, formatDate(campaign.createdAt)],
    [labels.startedAt, formatDate(campaign.startedAt)],
    [labels.completedAt, formatDate(campaign.completedAt)],
    [labels.total, String(campaign.total)],
    [labels.sent, String(campaign.sent)],
    [labels.delivered, String(campaign.deliveredCount)],
    [labels.read, String(campaign.readCount)],
    [labels.failed, String(failed)],
    [labels.replies, String(campaign.replyCount)],
  ];

  if (metrics) {
    rows.push(
      [labels.replyRate, formatPercent(metrics.replyRate)],
      [labels.funnelSent, String(metrics.funnel.sent)],
      [labels.funnelReplied, String(metrics.funnel.replied)],
      [labels.funnelHandoff, String(metrics.funnel.handoff)],
      [labels.funnelAdvisorResponded, String(metrics.funnel.advisorResponded)],
      [labels.funnelConverted, String(metrics.funnel.converted)]
    );
  }

  await downloadBillingReportPdf({
    title: labels.title,
    subtitle: `${campaign.name} (${campaign.campaignId})`,
    summaryLines: [
      `${labels.sent}: ${campaign.sent} · ${labels.delivered}: ${campaign.deliveredCount} · ${labels.failed}: ${failed}`,
    ],
    columns: [labels.metric, labels.value],
    rows,
    filename: buildCampaignResultsPdfFilename(campaign),
  });
}
