import type { MailrelayCredentials } from "../../types/index.js";
import { createMailrelayClient, type MailrelayClient } from "./client.js";
import {
  clearPlatformMailrelayEventSubscriptionId,
  getPlatformMailrelaySecret,
  savePlatformMailrelayEventSubscriptionId,
} from "./secrets.js";

export function configuredMailrelayEventTypes(): string[] {
  return [
    ...new Set(
      (process.env.MAILRELAY_EVENT_TYPES ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    ),
  ];
}

export function safeMailrelayEventTypes(requested: string[]): string[] {
  const allowed = new Set(configuredMailrelayEventTypes());
  return [...new Set(requested.filter((value) => allowed.has(value)))];
}

export async function ensureMailrelayEventSubscription(params: {
  credentials: MailrelayCredentials;
  enabled?: boolean;
  client?: MailrelayClient;
}): Promise<number | undefined> {
  const baseUrl = (
    process.env.MAILRELAY_WEBHOOK_BASE_URL ??
    process.env.API_PUBLIC_URL ??
    ""
  ).replace(/\/$/, "");
  const eventTypes = configuredMailrelayEventTypes();
  if (!baseUrl || eventTypes.length === 0) return undefined;

  const environment = process.env.ENVIRONMENT ?? "dev";
  const platformSecret = await getPlatformMailrelaySecret(environment);
  const client = params.client ?? createMailrelayClient(params.credentials);
  const body = {
    name: `Platform ${environment}`,
    delivery_method: "webhook",
    url: `${baseUrl}/email-marketing/webhook`,
    enabled: params.enabled !== false,
    event_types: eventTypes,
    http_headers: {
      "X-Mailrelay-Webhook-Token": params.credentials.webhookToken,
    },
  };
  const response = platformSecret?.eventSubscriptionId
    ? await client.request<Record<string, unknown>>(
        "PATCH",
        `/event_subscriptions/${platformSecret.eventSubscriptionId}`,
        { body }
      )
    : await client.request<Record<string, unknown>>("POST", "/event_subscriptions", { body });
  const id = Number(response.id ?? (response.data as Record<string, unknown> | undefined)?.id);
  if (Number.isInteger(id) && id > 0) {
    await savePlatformMailrelayEventSubscriptionId(environment, id);
    return id;
  }
  return platformSecret?.eventSubscriptionId;
}

export async function deleteMailrelayEventSubscription(
  credentials: MailrelayCredentials
): Promise<void> {
  const environment = process.env.ENVIRONMENT ?? "dev";
  const platformSecret = await getPlatformMailrelaySecret(environment);
  if (!platformSecret?.eventSubscriptionId) return;
  try {
    await createMailrelayClient(credentials).request(
      "DELETE",
      `/event_subscriptions/${platformSecret.eventSubscriptionId}`
    );
  } finally {
    await clearPlatformMailrelayEventSubscriptionId(environment);
  }
}
