import { getCampaign, listCampaignRecipients } from "../dynamodb/campaign.repository.js";
import { listAllBulkSendFailures } from "../dynamodb/bulk-job.repository.js";
import { listCampaignSendAttempts } from "../dynamodb/campaign-send-attempt.repository.js";
import type { Campaign, CampaignSendAttempt, OutreachChannel } from "../../types/index.js";

function escapeCsvCell(value: string | number | null | undefined): string {
  const str = String(value ?? "");
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function row(cells: (string | number | null | undefined)[]): string {
  return cells.map(escapeCsvCell).join(",");
}

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

function attemptSortKey(attempt: CampaignSendAttempt): string {
  return attempt.queuedAt ?? attempt.sentAt ?? attempt.createdAt;
}

function assignAttemptNumbers(attempts: CampaignSendAttempt[]): Map<string, number> {
  const byPhone = new Map<string, CampaignSendAttempt[]>();
  for (const attempt of attempts) {
    const phone = attempt.to.replace(/\D/g, "");
    const group = byPhone.get(phone) ?? [];
    group.push(attempt);
    byPhone.set(phone, group);
  }

  const numbers = new Map<string, number>();
  for (const group of byPhone.values()) {
    group.sort((a, b) => attemptSortKey(a).localeCompare(attemptSortKey(b)));
    group.forEach((attempt, index) => {
      numbers.set(attempt.attemptId, index + 1);
    });
  }
  return numbers;
}

const WHATSAPP_HEADERS = [
  "campaign_id",
  "campaign_name",
  "channel",
  "phone",
  "recipient_key",
  "attempt_number",
  "attempt_id",
  "status",
  "failure_kind",
  "template_name",
  "language",
  "queued_at",
  "sent_at",
  "delivered_at",
  "read_at",
  "failed_at",
  "external_message_id",
  "send_error_code",
  "send_error_title",
  "send_error_message",
  "delivery_error_code",
  "delivery_error_title",
  "delivery_error_message",
  "wa_message_id",
  "wa_recipient_id",
  "replied_at",
  "conversation_id",
  "batch_version",
  "batch_index",
];

const SMS_HEADERS = [
  "campaign_id",
  "campaign_name",
  "channel",
  "phone",
  "recipient_key",
  "attempt_number",
  "attempt_id",
  "status",
  "failure_kind",
  "template_name",
  "language",
  "queued_at",
  "sent_at",
  "delivered_at",
  "failed_at",
  "external_message_id",
  "send_error_code",
  "send_error_title",
  "send_error_message",
  "delivery_error_code",
  "delivery_error_title",
  "delivery_error_message",
  "sms_receipt_id",
  "telcored_message_id",
  "delivery_status",
  "final_delivery_code",
  "last_intermediate_code",
  "dlr_at",
  "cost",
  "part",
  "sender",
  "replied_at",
  "conversation_id",
  "batch_version",
  "batch_index",
  "request_dlr",
];

function whatsappRow(
  campaign: Campaign,
  attempt: CampaignSendAttempt,
  attemptNumber: number
): string {
  return row([
    campaign.campaignId,
    campaign.name,
    "whatsapp",
    attempt.to,
    attempt.recipientKey ?? "",
    attemptNumber,
    attempt.attemptId,
    attempt.status,
    attempt.failureKind ?? "",
    attempt.templateName,
    attempt.language,
    attempt.queuedAt,
    attempt.sentAt ?? "",
    attempt.deliveredAt ?? "",
    attempt.readAt ?? "",
    attempt.failedAt ?? "",
    attempt.externalMessageId ?? "",
    attempt.sendErrorCode ?? "",
    attempt.sendErrorTitle ?? "",
    attempt.sendErrorMessage ?? "",
    attempt.deliveryErrorCode ?? "",
    attempt.deliveryErrorTitle ?? "",
    attempt.deliveryErrorMessage ?? "",
    attempt.waMessageId ?? "",
    attempt.waRecipientId ?? "",
    attempt.repliedAt ?? "",
    attempt.conversationId ?? "",
    attempt.batchVersion ?? "",
    attempt.batchIndex ?? "",
  ]);
}

function smsRow(
  campaign: Campaign,
  attempt: CampaignSendAttempt,
  attemptNumber: number
): string {
  return row([
    campaign.campaignId,
    campaign.name,
    "sms",
    attempt.to,
    attempt.recipientKey ?? "",
    attemptNumber,
    attempt.attemptId,
    attempt.status,
    attempt.failureKind ?? "",
    attempt.templateName,
    attempt.language,
    attempt.queuedAt,
    attempt.sentAt ?? "",
    attempt.deliveredAt ?? "",
    attempt.failedAt ?? "",
    attempt.externalMessageId ?? "",
    attempt.sendErrorCode ?? "",
    attempt.sendErrorTitle ?? "",
    attempt.sendErrorMessage ?? "",
    attempt.deliveryErrorCode ?? "",
    attempt.deliveryErrorTitle ?? "",
    attempt.deliveryErrorMessage ?? "",
    attempt.smsReceiptId ?? "",
    attempt.telcoredMessageId ?? "",
    attempt.deliveryStatus ?? "",
    attempt.finalDeliveryCode ?? "",
    attempt.lastIntermediateCode ?? "",
    attempt.dlrAt ?? "",
    attempt.cost ?? "",
    attempt.part ?? "",
    attempt.sender ?? "",
    attempt.repliedAt ?? "",
    attempt.conversationId ?? "",
    attempt.batchVersion ?? "",
    attempt.batchIndex ?? "",
    campaign.requestDlr ? "true" : "false",
  ]);
}

async function buildLegacyRows(
  tenantId: string,
  campaign: Campaign,
  channel: OutreachChannel
): Promise<string[]> {
  const [recipients, failures] = await Promise.all([
    listCampaignRecipients(tenantId, campaign.campaignId),
    listAllBulkSendFailures(tenantId, campaign.campaignId),
  ]);

  const recipientByPhone = new Map(
    recipients.map((r) => [r.to.replace(/\D/g, ""), r])
  );

  const rows: string[] = [];
  const failuresByPhone = new Map<string, typeof failures>();
  for (const failure of failures) {
    const phone = failure.to.replace(/\D/g, "");
    const group = failuresByPhone.get(phone) ?? [];
    group.push(failure);
    failuresByPhone.set(phone, group);
  }

  const allPhones = new Set<string>([
    ...recipients.map((r) => r.to.replace(/\D/g, "")),
    ...failures.map((f) => f.to.replace(/\D/g, "")),
  ]);

  for (const phone of allPhones) {
    const recipient = recipientByPhone.get(phone);
    const phoneFailures = (failuresByPhone.get(phone) ?? []).sort((a, b) =>
      a.failedAt.localeCompare(b.failedAt)
    );
    let attemptNumber = 0;

    for (const failure of phoneFailures) {
      attemptNumber += 1;
      const attempt: CampaignSendAttempt = {
        attemptId: failure.attemptId ?? `legacy-fail-${attemptNumber}`,
        tenantId,
        campaignId: campaign.campaignId,
        to: phone,
        channel,
        status:
          failure.kind === "compliance"
            ? "compliance_blocked"
            : failure.kind === "delivery"
              ? "delivery_failed"
              : "send_failed",
        failureKind: failure.kind,
        templateName: campaign.templateName,
        language: campaign.language,
        queuedAt: failure.failedAt,
        failedAt: failure.failedAt,
        sendErrorMessage: failure.errorMessage,
        createdAt: failure.failedAt,
        updatedAt: failure.failedAt,
        ...(failure.errorCode != null ? { sendErrorCode: failure.errorCode } : {}),
        ...(failure.errorTitle ? { sendErrorTitle: failure.errorTitle } : {}),
        ...(failure.kind === "delivery" && failure.errorCode != null
          ? { deliveryErrorCode: failure.errorCode }
          : {}),
        ...(failure.kind === "delivery" && failure.errorTitle
          ? { deliveryErrorTitle: failure.errorTitle }
          : {}),
        ...(failure.kind === "delivery"
          ? { deliveryErrorMessage: failure.errorMessage }
          : {}),
        ...(failure.messageId ? { externalMessageId: failure.messageId } : {}),
        ...(channel === "whatsapp" && failure.messageId
          ? { waMessageId: failure.messageId }
          : {}),
        ...(recipient?.repliedAt ? { repliedAt: recipient.repliedAt } : {}),
        ...(recipient?.conversationId ? { conversationId: recipient.conversationId } : {}),
        ...(recipient ? { recipientKey: recipient.recipientKey } : {}),
      };
      rows.push(
        channel === "sms"
          ? smsRow(campaign, attempt, attemptNumber)
          : whatsappRow(campaign, attempt, attemptNumber)
      );
    }

    if (recipient && (recipient.status === "sent" || recipient.status === "replied")) {
      attemptNumber += 1;
      const attempt: CampaignSendAttempt = {
        attemptId: `legacy-success-${phone}`,
        tenantId,
        campaignId: campaign.campaignId,
        to: phone,
        channel,
        status: "sent",
        templateName: campaign.templateName,
        language: campaign.language,
        queuedAt: recipient.repliedAt ?? campaign.startedAt ?? campaign.createdAt,
        sentAt: campaign.startedAt ?? campaign.createdAt,
        createdAt: campaign.createdAt,
        updatedAt: campaign.updatedAt,
        recipientKey: recipient.recipientKey,
        ...(recipient.repliedAt ? { repliedAt: recipient.repliedAt } : {}),
        ...(recipient.conversationId ? { conversationId: recipient.conversationId } : {}),
      };
      rows.push(
        channel === "sms"
          ? smsRow(campaign, attempt, attemptNumber)
          : whatsappRow(campaign, attempt, attemptNumber)
      );
    } else if (!phoneFailures.length && recipient?.status === "pending") {
      attemptNumber += 1;
      const attempt: CampaignSendAttempt = {
        attemptId: `legacy-pending-${phone}`,
        tenantId,
        campaignId: campaign.campaignId,
        to: phone,
        channel,
        status: "queued",
        templateName: campaign.templateName,
        language: campaign.language,
        queuedAt: campaign.createdAt,
        recipientKey: recipient.recipientKey,
        createdAt: campaign.createdAt,
        updatedAt: campaign.updatedAt,
      };
      rows.push(
        channel === "sms"
          ? smsRow(campaign, attempt, attemptNumber)
          : whatsappRow(campaign, attempt, attemptNumber)
      );
    } else if (!phoneFailures.length && recipient?.status === "failed") {
      attemptNumber += 1;
      const attempt: CampaignSendAttempt = {
        attemptId: `legacy-failed-${phone}`,
        tenantId,
        campaignId: campaign.campaignId,
        to: phone,
        channel,
        status: "send_failed",
        failureKind: "send",
        templateName: campaign.templateName,
        language: campaign.language,
        queuedAt: campaign.createdAt,
        failedAt: campaign.updatedAt,
        sendErrorMessage: "Send failed",
        recipientKey: recipient.recipientKey,
        createdAt: campaign.createdAt,
        updatedAt: campaign.updatedAt,
      };
      rows.push(
        channel === "sms"
          ? smsRow(campaign, attempt, attemptNumber)
          : whatsappRow(campaign, attempt, attemptNumber)
      );
    }
  }

  return rows;
}

export async function buildCampaignExportCsv(
  tenantId: string,
  campaignId: string
): Promise<{ filename: string; content: string } | null> {
  const campaign = await getCampaign(tenantId, campaignId);
  if (!campaign) return null;

  const channel: OutreachChannel = campaign.channel ?? "whatsapp";
  const date = new Date().toISOString().slice(0, 10);
  const slug = slugifyName(campaign.name);
  const filename = `campaign-${channel}-${slug}-${date}.csv`;

  const attempts = await listCampaignSendAttempts(tenantId, campaignId);
  const lines: string[] = [];

  if (attempts.length > 0) {
    const recipients = await listCampaignRecipients(tenantId, campaignId);
    const recipientByKey = new Map(recipients.map((r) => [r.recipientKey, r]));

    for (const attempt of attempts) {
      if (attempt.recipientKey && recipientByKey.has(attempt.recipientKey)) {
        const recipient = recipientByKey.get(attempt.recipientKey)!;
        if (recipient.repliedAt) attempt.repliedAt = recipient.repliedAt;
        if (recipient.conversationId) attempt.conversationId = recipient.conversationId;
      }
    }

    const attemptNumbers = assignAttemptNumbers(attempts);
    const sorted = [...attempts].sort((a, b) => {
      const phoneCmp = a.to.localeCompare(b.to);
      if (phoneCmp !== 0) return phoneCmp;
      return attemptSortKey(a).localeCompare(attemptSortKey(b));
    });

    lines.push(channel === "sms" ? row(SMS_HEADERS) : row(WHATSAPP_HEADERS));
    for (const attempt of sorted) {
      const attemptNumber = attemptNumbers.get(attempt.attemptId) ?? 1;
      lines.push(
        channel === "sms"
          ? smsRow(campaign, attempt, attemptNumber)
          : whatsappRow(campaign, attempt, attemptNumber)
      );
    }
  } else {
    const legacyRows = await buildLegacyRows(tenantId, campaign, channel);
    lines.push(channel === "sms" ? row(SMS_HEADERS) : row(WHATSAPP_HEADERS));
    lines.push(...legacyRows);
  }

  const content = `\uFEFF${lines.join("\r\n")}`;
  return { filename, content };
}
