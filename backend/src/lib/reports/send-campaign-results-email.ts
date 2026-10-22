import { getCampaign } from "../dynamodb/campaign.repository.js";
import { sendEmailWithAttachment } from "../email/client.js";
import { buildCampaignExportCsv } from "./campaign-export-csv.js";
import type { Campaign } from "../../types/index.js";

function formatDate(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toISOString();
  } catch {
    return iso;
  }
}

function buildEmailBody(campaign: Campaign): { subject: string; text: string } {
  const channel = campaign.channel ?? "whatsapp";
  const subject = `Campaign results: ${campaign.name}`;
  const text = [
    `Hello,`,
    ``,
    `Attached is the CSV export with send records for the campaign "${campaign.name}".`,
    ``,
    `Campaign summary:`,
    `- ID: ${campaign.campaignId}`,
    `- Channel: ${channel}`,
    `- Status: ${campaign.status}`,
    `- Created: ${formatDate(campaign.createdAt)}`,
    `- Started: ${formatDate(campaign.startedAt)}`,
    `- Completed: ${formatDate(campaign.completedAt)}`,
    `- Total recipients: ${campaign.total}`,
    `- Sent: ${campaign.sent}`,
    `- Delivered: ${campaign.deliveredCount}`,
    `- Read: ${campaign.readCount}`,
    `- Failed: ${campaign.failed + campaign.deliveryFailed}`,
    `- Replies: ${campaign.replyCount}`,
    ``,
    `This report was generated from the campaigns results view.`,
  ].join("\n");
  return { subject, text };
}

export async function sendCampaignResultsEmail(params: {
  tenantId: string;
  campaignId: string;
  to: string[];
}): Promise<{ messageId: string; filename: string; recipients: string[] }> {
  const campaign = await getCampaign(params.tenantId, params.campaignId);
  if (!campaign) {
    throw new Error("CAMPAIGN_NOT_FOUND");
  }

  if (campaign.status === "draft" || campaign.status === "scheduled") {
    throw new Error("CAMPAIGN_NOT_EXPORTABLE");
  }

  const recipients = [
    ...new Set(params.to.map((email) => email.trim().toLowerCase()).filter(Boolean)),
  ];
  if (recipients.length === 0) {
    throw new Error("NO_RECIPIENTS");
  }

  const exportResult = await buildCampaignExportCsv(params.tenantId, params.campaignId);
  if (!exportResult) {
    throw new Error("CAMPAIGN_NOT_FOUND");
  }

  const { subject, text } = buildEmailBody(campaign);
  const { messageId } = await sendEmailWithAttachment({
    to: recipients,
    subject,
    text,
    attachments: [
      {
        filename: exportResult.filename,
        contentType: "text/csv; charset=utf-8",
        data: Buffer.from(exportResult.content, "utf-8"),
      },
    ],
  });

  return {
    messageId,
    filename: exportResult.filename,
    recipients,
  };
}
