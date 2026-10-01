import { createHmac, timingSafeEqual } from "crypto";
import { getShopifyAppCredentials } from "./secrets.js";

export const SHOPIFY_SCOPES = ["read_orders", "read_checkouts", "read_customers"].join(",");

export const SHOPIFY_WEBHOOK_TOPICS = [
  "checkouts/create",
  "checkouts/update",
  "orders/create",
  "orders/paid",
  "orders/cancelled",
  "fulfillments/create",
  "fulfillments/update",
  "app/uninstalled",
  "customers/data_request",
  "customers/redact",
  "shop/redact",
] as const;

export interface ShopifyTokenResponse {
  access_token: string;
  scope?: string;
  expires_in?: number;
  refresh_token?: string;
}

export interface ShopifyWebhook {
  id: number;
  topic: string;
  address: string;
}

function normalizeShopDomain(shop: string): string {
  const trimmed = shop.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!trimmed.endsWith(".myshopify.com")) {
    throw Object.assign(new Error("Shop domain must end with .myshopify.com"), {
      statusCode: 400,
    });
  }
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(trimmed)) {
    throw Object.assign(new Error("Invalid Shopify shop domain"), { statusCode: 400 });
  }
  return trimmed;
}

export function parseShopDomain(shop: string): string {
  return normalizeShopDomain(shop);
}

export function buildOAuthUrl(shop: string, state: string): string {
  const domain = normalizeShopDomain(shop);
  const { apiKey, redirectUri } = getShopifyAppCredentials();
  const params = new URLSearchParams({
    client_id: apiKey,
    scope: SHOPIFY_SCOPES,
    redirect_uri: redirectUri,
    state,
  });
  return `https://${domain}/admin/oauth/authorize?${params.toString()}`;
}

export function verifyOAuthHmac(query: Record<string, string | undefined>): boolean {
  const { apiSecret } = getShopifyAppCredentials();
  const hmac = query.hmac?.trim() ?? "";
  if (!hmac) return false;
  const message = Object.keys(query)
    .filter((key) => key !== "hmac" && key !== "signature" && query[key] !== undefined)
    .sort()
    .map((key) => `${key}=${query[key]}`)
    .join("&");
  const digest = createHmac("sha256", apiSecret).update(message).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(digest, "utf8"), Buffer.from(hmac, "utf8"));
  } catch {
    return false;
  }
}

export function verifyWebhookHmac(rawBody: string, hmacHeader: string | undefined): boolean {
  if (!hmacHeader?.trim()) return false;
  const { apiSecret } = getShopifyAppCredentials();
  const digest = createHmac("sha256", apiSecret).update(rawBody, "utf8").digest("base64");
  try {
    return timingSafeEqual(Buffer.from(digest, "utf8"), Buffer.from(hmacHeader.trim(), "utf8"));
  } catch {
    return false;
  }
}

export async function exchangeCodeForTokens(
  shop: string,
  code: string
): Promise<ShopifyTokenResponse> {
  const domain = normalizeShopDomain(shop);
  const { apiKey, apiSecret } = getShopifyAppCredentials();
  const response = await fetch(`https://${domain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: apiKey,
      client_secret: apiSecret,
      code,
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw Object.assign(new Error(body || "Shopify token exchange failed"), {
      statusCode: 400,
    });
  }
  return (await response.json()) as ShopifyTokenResponse;
}

export async function refreshAccessToken(
  shop: string,
  refreshToken: string
): Promise<ShopifyTokenResponse> {
  const domain = normalizeShopDomain(shop);
  const { apiKey, apiSecret } = getShopifyAppCredentials();
  const response = await fetch(`https://${domain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: apiKey,
      client_secret: apiSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw Object.assign(new Error(body || "Shopify token refresh failed"), {
      statusCode: 401,
    });
  }
  return (await response.json()) as ShopifyTokenResponse;
}

async function adminFetch<T>(
  shop: string,
  accessToken: string,
  path: string,
  init?: RequestInit
): Promise<T> {
  const domain = normalizeShopDomain(shop);
  const { apiVersion } = getShopifyAppCredentials();
  const response = await fetch(`https://${domain}/admin/api/${apiVersion}${path}`, {
    ...init,
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw Object.assign(new Error(body || `Shopify API ${response.status}`), {
      statusCode: response.status === 401 ? 401 : 502,
    });
  }
  if (response.status === 204) return {} as T;
  return (await response.json()) as T;
}

export async function registerWebhooks(
  shop: string,
  accessToken: string,
  address: string
): Promise<string[]> {
  const ids: string[] = [];
  for (const topic of SHOPIFY_WEBHOOK_TOPICS) {
    try {
      const result = await adminFetch<{ webhook: ShopifyWebhook }>(
        shop,
        accessToken,
        "/webhooks.json",
        {
          method: "POST",
          body: JSON.stringify({
            webhook: { topic, address, format: "json" },
          }),
        }
      );
      if (result.webhook?.id) ids.push(String(result.webhook.id));
    } catch (error) {
      console.warn("Shopify webhook register failed", { topic, error });
    }
  }
  return ids;
}

export async function deleteWebhooks(
  shop: string,
  accessToken: string,
  webhookIds: string[]
): Promise<void> {
  for (const id of webhookIds) {
    try {
      await adminFetch(shop, accessToken, `/webhooks/${id}.json`, { method: "DELETE" });
    } catch {
      // ignore missing webhooks on disconnect
    }
  }
}

export async function getCheckout(
  shop: string,
  accessToken: string,
  token: string
): Promise<Record<string, unknown> | null> {
  try {
    const result = await adminFetch<{ checkout?: Record<string, unknown> }>(
      shop,
      accessToken,
      `/checkouts/${encodeURIComponent(token)}.json`
    );
    return result.checkout ?? null;
  } catch {
    return null;
  }
}
