import { randomUUID } from "crypto";
import {
  deleteShopifyCheckoutsForTenant,
  deleteShopifyConfig,
  deleteShopifyDeliveriesForTenant,
  getShopifyConfig,
  listShopifyDeliveries,
  upsertShopifyConfig,
} from "../dynamodb/shopify.repository.js";
import { putShopifyOAuthState, consumeShopifyOAuthState } from "../dynamodb/shopify-oauth.repository.js";
import {
  buildOAuthUrl,
  deleteWebhooks,
  exchangeCodeForTokens,
  parseShopDomain,
  registerWebhooks,
  verifyOAuthHmac,
} from "./client.js";
import {
  deleteShopifyShopTokens,
  getShopifyShopTokens,
  saveShopifyShopTokens,
} from "./secrets.js";
import type {
  ShopifyConfig,
  ShopifyDelivery,
  ShopifyNotificationEvent,
  ShopifyTemplateMapping,
} from "../../types/index.js";

export interface ShopifyConnectionView {
  connected: boolean;
  configured: boolean;
  enabled: boolean;
  status?: ShopifyConfig["status"];
  shopDomain?: string;
  botId?: string;
  abandonDelayMinutes: number;
  defaultCountry: string;
  templates: Partial<Record<ShopifyNotificationEvent, ShopifyTemplateMapping>>;
  connectedAt?: string;
  lastError?: string;
}

function frontendBaseUrl(): string {
  return (process.env.FRONTEND_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function webhookAddress(): string {
  return `${(process.env.API_PUBLIC_URL ?? "").replace(/\/$/, "")}/public/integrations/shopify/webhook`;
}

function defaultConfig(tenantId: string, shopDomain = ""): ShopifyConfig {
  const now = new Date().toISOString();
  return {
    tenantId,
    shopDomain,
    status: "disconnected",
    enabled: false,
    abandonDelayMinutes: 60,
    defaultCountry: "CO",
    templates: {},
    createdAt: now,
    updatedAt: now,
  };
}

function toView(config: ShopifyConfig | null, hasTokens: boolean): ShopifyConnectionView {
  if (!config) {
    return {
      connected: false,
      configured: false,
      enabled: false,
      abandonDelayMinutes: 60,
      defaultCountry: "CO",
      templates: {},
    };
  }
  return {
    connected: hasTokens && config.status === "connected",
    configured: hasTokens || Boolean(config.shopDomain),
    enabled: config.enabled,
    status: config.status,
    ...(config.shopDomain ? { shopDomain: config.shopDomain } : {}),
    ...(config.botId ? { botId: config.botId } : {}),
    abandonDelayMinutes: config.abandonDelayMinutes,
    defaultCountry: config.defaultCountry,
    templates: config.templates ?? {},
    ...(config.connectedAt ? { connectedAt: config.connectedAt } : {}),
    ...(config.lastError ? { lastError: config.lastError } : {}),
  };
}

export async function getShopifyConnectionView(
  tenantId: string,
  environment: string
): Promise<ShopifyConnectionView> {
  const config = await getShopifyConfig(tenantId);
  const tokens = await getShopifyShopTokens(tenantId, environment);
  return toView(config, Boolean(tokens?.accessToken));
}

export async function startShopifyOAuth(
  tenantId: string,
  shop: string
): Promise<{ authUrl: string; state: string }> {
  const shopDomain = parseShopDomain(shop);
  const state = randomUUID();
  await putShopifyOAuthState(state, { tenantId, shopDomain });
  return { authUrl: buildOAuthUrl(shopDomain, state), state };
}

export async function handleShopifyOAuthCallback(
  query: Record<string, string | undefined>,
  environment: string
): Promise<string> {
  const code = query.code?.trim() ?? "";
  const state = query.state?.trim() ?? "";
  const shop = query.shop?.trim() ?? "";
  const oauthError = query.error?.trim() ?? "";

  if (oauthError) {
    return `${frontendBaseUrl()}/apps/shopify?error=${encodeURIComponent(oauthError)}`;
  }
  if (!code || !state || !shop) {
    return `${frontendBaseUrl()}/apps/shopify?error=missing_oauth_params`;
  }
  if (!verifyOAuthHmac(query)) {
    return `${frontendBaseUrl()}/apps/shopify?error=invalid_hmac`;
  }

  const oauthState = await consumeShopifyOAuthState(state);
  if (!oauthState) {
    return `${frontendBaseUrl()}/apps/shopify?error=invalid_state`;
  }

  try {
    const shopDomain = parseShopDomain(shop);
    if (shopDomain !== oauthState.shopDomain) {
      return `${frontendBaseUrl()}/apps/shopify?error=shop_mismatch`;
    }

    const tokenResponse = await exchangeCodeForTokens(shopDomain, code);
    await saveShopifyShopTokens(oauthState.tenantId, environment, {
      accessToken: tokenResponse.access_token,
      ...(tokenResponse.refresh_token ? { refreshToken: tokenResponse.refresh_token } : {}),
      ...(tokenResponse.expires_in
        ? { expiresAt: Date.now() + tokenResponse.expires_in * 1000 }
        : {}),
      ...(tokenResponse.scope ? { scope: tokenResponse.scope } : {}),
    });

    const webhookIds = await registerWebhooks(
      shopDomain,
      tokenResponse.access_token,
      webhookAddress()
    );

    const existing = (await getShopifyConfig(oauthState.tenantId)) ?? defaultConfig(oauthState.tenantId);
    const now = new Date().toISOString();
    const { lastError: _lastError, ...existingWithoutError } = existing;
    void _lastError;
    await upsertShopifyConfig({
      ...existingWithoutError,
      shopDomain,
      status: "connected",
      enabled: existing.enabled || Boolean(existing.botId),
      webhookIds,
      connectedAt: existing.connectedAt ?? now,
      updatedAt: now,
    });

    return `${frontendBaseUrl()}/apps/shopify?connected=1`;
  } catch (error) {
    const message = error instanceof Error ? error.message : "oauth_failed";
    return `${frontendBaseUrl()}/apps/shopify?error=${encodeURIComponent(message)}`;
  }
}

export async function updateShopifySettings(
  tenantId: string,
  environment: string,
  params: {
    enabled?: boolean;
    botId?: string;
    abandonDelayMinutes?: number;
    defaultCountry?: string;
    templates?: Partial<Record<ShopifyNotificationEvent, ShopifyTemplateMapping>>;
  }
): Promise<ShopifyConnectionView> {
  const existing = (await getShopifyConfig(tenantId)) ?? defaultConfig(tenantId);
  const tokens = await getShopifyShopTokens(tenantId, environment);
  if (!tokens?.accessToken || !existing.shopDomain) {
    throw Object.assign(new Error("Connect a Shopify store first"), { statusCode: 400 });
  }

  const updated: ShopifyConfig = {
    ...existing,
    ...(params.enabled !== undefined ? { enabled: params.enabled } : {}),
    ...(params.botId !== undefined ? { botId: params.botId } : {}),
    ...(params.abandonDelayMinutes !== undefined
      ? { abandonDelayMinutes: Math.max(5, Math.min(24 * 60, params.abandonDelayMinutes)) }
      : {}),
    ...(params.defaultCountry !== undefined
      ? { defaultCountry: params.defaultCountry.toUpperCase().slice(0, 2) }
      : {}),
    ...(params.templates !== undefined
      ? { templates: { ...existing.templates, ...params.templates } }
      : {}),
    updatedAt: new Date().toISOString(),
  };

  await upsertShopifyConfig(updated);
  return toView(updated, true);
}

export async function disconnectShopify(
  tenantId: string,
  environment: string
): Promise<ShopifyConnectionView> {
  const config = await getShopifyConfig(tenantId);
  const tokens = await getShopifyShopTokens(tenantId, environment);
  if (config?.shopDomain && tokens?.accessToken && config.webhookIds?.length) {
    try {
      await deleteWebhooks(config.shopDomain, tokens.accessToken, config.webhookIds);
    } catch {
      // continue disconnect
    }
  }
  await deleteShopifyShopTokens(tenantId, environment);
  await deleteShopifyCheckoutsForTenant(tenantId);
  await deleteShopifyDeliveriesForTenant(tenantId);
  await deleteShopifyConfig(tenantId);
  return toView(null, false);
}

export async function listShopifyDeliveryHistory(
  tenantId: string,
  limit = 50
): Promise<ShopifyDelivery[]> {
  return listShopifyDeliveries(tenantId, limit);
}
