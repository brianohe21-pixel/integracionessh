import { getTenantUsageMetrics } from "../dynamodb/metrics.repository.js";
import { getMarketingMetrics } from "../dynamodb/marketing-metrics.repository.js";

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

function sectionTitle(title: string): string {
  return row([title]);
}

function blankRow(): string {
  return "";
}

export async function buildUsageMarketingCsv(
  tenantId: string
): Promise<{ filename: string; content: string }> {
  const [usage, marketing] = await Promise.all([
    getTenantUsageMetrics(tenantId),
    getMarketingMetrics(tenantId),
  ]);

  const date = new Date().toISOString().slice(0, 10);
  const lines: string[] = [];

  lines.push(sectionTitle("Usage summary"));
  lines.push(
    row([
      "metric",
      "value",
    ])
  );
  lines.push(row(["total_bots", usage.summary.totalBots]));
  lines.push(row(["active_bots", usage.summary.activeBots]));
  lines.push(row(["total_conversations", usage.summary.totalConversations]));
  lines.push(row(["active_conversations", usage.summary.activeConversations]));
  lines.push(row(["total_messages", usage.summary.totalMessages]));
  lines.push(row(["total_templates", usage.summary.totalTemplates]));
  lines.push(row(["bulk_jobs_count", usage.summary.bulkJobsCount]));
  lines.push(row(["bulk_messages_sent", usage.summary.bulkMessagesSent]));
  lines.push(row(["bulk_messages_failed", usage.summary.bulkMessagesFailed]));
  lines.push(row(["last_activity_at", usage.summary.lastActivityAt ?? ""]));

  lines.push(blankRow());
  lines.push(sectionTitle("Usage by bot"));
  lines.push(
    row([
      "bot_id",
      "bot_name",
      "status",
      "conversations",
      "active_conversations",
      "messages",
      "templates",
      "last_activity_at",
    ])
  );
  for (const bot of usage.byBot) {
    lines.push(
      row([
        bot.botId,
        bot.botName,
        bot.status,
        bot.conversations,
        bot.activeConversations,
        bot.messages,
        bot.templates,
        bot.lastActivityAt ?? "",
      ])
    );
  }

  lines.push(blankRow());
  lines.push(sectionTitle("Marketing summary"));
  lines.push(row(["metric", "value"]));
  lines.push(row(["campaigns_total", marketing.campaigns.total]));
  lines.push(row(["campaigns_active", marketing.campaigns.active]));
  lines.push(row(["campaigns_completed", marketing.campaigns.completed]));
  lines.push(row(["campaigns_sent", marketing.campaigns.aggregates.sent]));
  lines.push(row(["campaigns_delivered", marketing.campaigns.aggregates.delivered]));
  lines.push(row(["campaigns_read", marketing.campaigns.aggregates.read]));
  lines.push(row(["campaigns_delivery_failed", marketing.campaigns.aggregates.deliveryFailed]));
  lines.push(row(["campaigns_delivery_rate", marketing.campaigns.rates.deliveryRate]));
  lines.push(row(["campaigns_read_rate", marketing.campaigns.rates.readRate]));
  lines.push(row(["bulk_jobs_count", marketing.bulk.jobsCount]));
  lines.push(row(["bulk_sent", marketing.bulk.sent]));
  lines.push(row(["bulk_failed", marketing.bulk.failed]));
  lines.push(row(["bulk_success_rate", marketing.bulk.rates.successRate]));
  lines.push(row(["inbox_open", marketing.inbox.open]));
  lines.push(row(["inbox_pending", marketing.inbox.pending]));
  lines.push(row(["inbox_resolved_today", marketing.inbox.resolvedToday]));

  lines.push(blankRow());
  lines.push(sectionTitle("Top campaigns"));
  lines.push(
    row([
      "campaign_id",
      "name",
      "sent",
      "delivered",
      "read",
      "delivery_rate",
      "read_rate",
    ])
  );
  for (const campaign of marketing.topCampaigns) {
    lines.push(
      row([
        campaign.campaignId,
        campaign.name,
        campaign.sent,
        campaign.deliveredCount,
        campaign.readCount,
        campaign.deliveryRate,
        campaign.readRate,
      ])
    );
  }

  const content = `\uFEFF${lines.join("\n")}`;
  return { filename: `metrics-${date}.csv`, content };
}
