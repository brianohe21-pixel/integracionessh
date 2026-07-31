import { getTenant, updateTenant } from "../dynamodb/tenant.repository.js";
import { sendEmailWithAttachment } from "../email/client.js";
import { buildUsageMarketingCsv } from "./metrics-csv.js";
import type { MetricsReportSchedule } from "../../types/index.js";

function formatFrequencyLabel(schedule: MetricsReportSchedule): string {
  if (schedule.frequency === "daily") return "daily";
  return "weekly";
}

function buildEmailBody(
  tenantName: string,
  schedule: MetricsReportSchedule
): { subject: string; text: string } {
  const frequency = formatFrequencyLabel(schedule);
  const subject = `${tenantName} — ${frequency} metrics report`;
  const text = [
    `Hello,`,
    ``,
    `Attached is your ${frequency} usage and marketing metrics report for ${tenantName}.`,
    ``,
    `This report was generated automatically.`,
  ].join("\n");
  return { subject, text };
}

export async function sendScheduledReport(
  tenantId: string,
  options?: { force?: boolean }
): Promise<void> {
  const tenant = await getTenant(tenantId);
  if (!tenant) {
    console.warn("Tenant not found for scheduled report", { tenantId });
    return;
  }

  const schedule = tenant.metricsReportSchedule;
  if (!schedule || (!options?.force && !schedule.enabled)) {
    return;
  }

  const recipients = schedule.recipients.map((email) => email.trim()).filter(Boolean);
  if (recipients.length === 0) {
    console.warn("No recipients configured for scheduled report", { tenantId });
    return;
  }

  const { filename, content } = await buildUsageMarketingCsv(tenantId);
  const { subject, text } = buildEmailBody(tenant.name, schedule);

  await sendEmailWithAttachment({
    to: recipients,
    subject,
    text,
    attachments: [
      {
        filename,
        contentType: "text/csv; charset=utf-8",
        data: Buffer.from(content, "utf-8"),
      },
    ],
  });

  await updateTenant(tenantId, {
    metricsReportSchedule: {
      ...schedule,
      lastSentAt: new Date().toISOString(),
    },
  });
}
