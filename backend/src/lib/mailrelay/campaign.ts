const UNSUBSCRIBE_PATTERN = /unsubscribe_url|%UNSUBSCRIBE%/i;

const DEFAULT_UNSUBSCRIBE_FOOTER =
  '<p style="font-size:12px;color:#666;margin-top:24px;"><a href="{{ unsubscribe_url }}">Unsubscribe</a></p>';

export function hasMailrelayUnsubscribeLink(html: string): boolean {
  return UNSUBSCRIBE_PATTERN.test(html);
}

export function ensureMailrelayCampaignHtml(html: string): string {
  const trimmed = html.trim();
  if (!trimmed || hasMailrelayUnsubscribeLink(trimmed)) return trimmed;
  return `${trimmed}\n${DEFAULT_UNSUBSCRIBE_FOOTER}`;
}

export type MailrelaySendOverride = {
  target?: string | undefined;
  group_ids?: number[] | undefined;
  segment_id?: number | undefined;
  scheduled_at?: string | undefined;
  callback_url?: string | undefined;
};

export function buildMailrelaySendPayload(
  campaign: Record<string, unknown>,
  override: MailrelaySendOverride = {}
): Record<string, unknown> {
  const target = String(override.target ?? campaign.target ?? "").trim();
  if (!target) {
    const error = new Error("Campaign target is missing");
    (error as Error & { statusCode: number }).statusCode = 422;
    throw error;
  }

  const body: Record<string, unknown> = { target };

  if (target === "groups") {
    const groupIds =
      override.group_ids ??
      (Array.isArray(campaign.group_ids)
        ? campaign.group_ids
            .map((value) => Number(value))
            .filter((value) => Number.isInteger(value) && value > 0)
        : []);
    if (groupIds.length === 0) {
      const error = new Error("Campaign audience groups are missing");
      (error as Error & { statusCode: number }).statusCode = 422;
      throw error;
    }
    body.group_ids = groupIds;
  } else if (target === "segment") {
    const segmentId = Number(override.segment_id ?? campaign.segment_id);
    if (!Number.isInteger(segmentId) || segmentId <= 0) {
      const error = new Error("Campaign segment is missing");
      (error as Error & { statusCode: number }).statusCode = 422;
      throw error;
    }
    body.segment_id = segmentId;
  }

  if (override.scheduled_at) body.scheduled_at = override.scheduled_at;
  if (override.callback_url) body.callback_url = override.callback_url;

  return body;
}
