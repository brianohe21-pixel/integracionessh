const UNSUBSCRIBE_PATTERN = /unsubscribe_link|unsubscribe_url|%UNSUBSCRIBE%/i;

const DEFAULT_UNSUBSCRIBE_FOOTER =
  '<p style="font-size:12px;color:#666;margin-top:24px;"><a href="[unsubscribe_link]">Unsubscribe</a></p>';

export function hasNrs360UnsubscribeLink(html: string): boolean {
  return UNSUBSCRIBE_PATTERN.test(html);
}

export function ensureNrs360CampaignHtml(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) return trimmed;
  if (/\[unsubscribe_link\]/i.test(trimmed)) return trimmed;
  if (/unsubscribe_url|%UNSUBSCRIBE%/i.test(trimmed)) {
    return trimmed
      .replace(/\{\{\s*unsubscribe_url\s*\}\}/gi, "[unsubscribe_link]")
      .replace(/%UNSUBSCRIBE%/gi, "[unsubscribe_link]");
  }
  return `${trimmed}\n${DEFAULT_UNSUBSCRIBE_FOOTER}`;
}

export function metricsFromNrs360Campaign(campaign: Record<string, unknown>): {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  hardBounced: number;
  softBounced: number;
  unsubscribed: number;
  complained: number;
} {
  const sendings = campaign.sendings;
  const sendingData =
    sendings && typeof sendings === "object" && !Array.isArray(sendings)
      ? (sendings as Record<string, unknown>).data
      : undefined;
  const rows = Array.isArray(sendingData) ? sendingData : [];
  let sent = 0;
  let opened = 0;
  let clicked = 0;
  let hardBounced = 0;
  let softBounced = 0;
  let unsubscribed = 0;
  let complained = 0;

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const stats = (row as Record<string, unknown>).stats;
    const values =
      stats && typeof stats === "object" && !Array.isArray(stats)
        ? (stats as Record<string, unknown>)
        : (row as Record<string, unknown>);
    sent += Number(values.sent ?? 0) || 0;
    opened += Number(values.opened ?? values.opened_unique ?? 0) || 0;
    clicked += Number(values.clicked ?? values.clicked_unique ?? 0) || 0;
    hardBounced += Number(values.hard_bounced ?? 0) || 0;
    softBounced += Number(values.soft_bounced ?? 0) || 0;
    unsubscribed +=
      (Number(values.unsubscribed ?? 0) || 0) + (Number(values.unsubscribed_landing ?? 0) || 0);
    complained += Number(values.complaint ?? values.complained ?? 0) || 0;
  }

  const bounced = hardBounced + softBounced;
  return {
    sent,
    delivered: Math.max(sent - bounced, 0),
    opened,
    clicked,
    bounced,
    hardBounced,
    softBounced,
    unsubscribed,
    complained,
  };
}
