const GRAPH_API_URL = "https://graph.facebook.com/v22.0";

export const INSTAGRAM_PAGE_WEBHOOK_FIELDS = [
  "messages",
  "messaging_postbacks",
  "messaging_optins",
  "message_reactions",
  "messaging_referrals",
  "messaging_seen",
] as const;

export async function subscribeInstagramPageWebhooks(
  pageId: string,
  pageAccessToken: string,
  fields: readonly string[] = INSTAGRAM_PAGE_WEBHOOK_FIELDS
): Promise<void> {
  const response = await fetch(`${GRAPH_API_URL}/${pageId}/subscribed_apps`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${pageAccessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subscribed_fields: [...fields],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    const err = new Error(`Failed to subscribe Instagram page to webhooks: ${body}`) as Error & {
      statusCode?: number;
    };
    err.statusCode = 502;
    throw err;
  }
}
