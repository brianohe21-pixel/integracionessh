import {
  deleteShopifyCheckoutsByPhone,
  deleteShopifyCheckoutsForTenant,
  deleteShopifyConfig,
  deleteShopifyDeliveriesByPhone,
  deleteShopifyDeliveriesForTenant,
  getShopifyCheckout,
  getShopifyConfig,
  putShopifyCheckout,
} from "../dynamodb/shopify.repository.js";
import { deleteShopifyShopTokens, getShopifyShopTokens } from "./secrets.js";
import { getCheckout } from "./client.js";
import { extractPhoneFromShopifyPayload } from "./phone.js";
import { sendShopifyWhatsAppTemplate } from "./notify.js";
import {
  cancelAbandonedCheckoutSchedule,
  scheduleAbandonedCheckout,
} from "./schedule.js";
import { resolveShopifyAccessToken } from "./token.js";
import type { ShopifyConfig } from "../../types/index.js";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function money(payload: Record<string, unknown>): string {
  const total =
    payload.total_price ??
    payload.total_price_set ??
    (asRecord(payload.total_price_set).shop_money as Record<string, unknown> | undefined)
      ?.amount;
  if (typeof total === "string" || typeof total === "number") return String(total);
  const shopMoney = asRecord(asRecord(payload.total_price_set).shop_money);
  if (typeof shopMoney.amount === "string" || typeof shopMoney.amount === "number") {
    return String(shopMoney.amount);
  }
  return "";
}

async function handleCheckoutEvent(
  tenantId: string,
  config: ShopifyConfig,
  payload: Record<string, unknown>,
  environment: string
): Promise<void> {
  const token =
    (typeof payload.token === "string" && payload.token) ||
    (typeof payload.abandoned_checkout_url === "string"
      ? payload.abandoned_checkout_url.split("/").pop()
      : "") ||
    "";
  if (!token) return;

  const { phone, name } = extractPhoneFromShopifyPayload(payload, config.defaultCountry);
  if (!phone) return;

  const existing = await getShopifyCheckout(tenantId, token);
  if (existing?.status === "converted" || existing?.status === "notified") return;

  const delayMinutes = Math.max(5, config.abandonDelayMinutes || 60);
  const notifyAt = new Date(Date.now() + delayMinutes * 60_000);
  const scheduleName = await scheduleAbandonedCheckout({
    tenantId,
    checkoutToken: token,
    notifyAt,
    ...(existing?.scheduleName ? { previousScheduleName: existing.scheduleName } : {}),
  });

  const now = new Date().toISOString();
  const totalPrice = money(payload);
  await putShopifyCheckout({
    tenantId,
    checkoutToken: token,
    shopDomain: config.shopDomain,
    phone,
    ...(name ? { customerName: name } : {}),
    ...(totalPrice ? { totalPrice } : {}),
    ...(typeof payload.currency === "string" ? { currency: payload.currency } : {}),
    ...(typeof payload.abandoned_checkout_url === "string"
      ? { abandonedCheckoutUrl: payload.abandoned_checkout_url }
      : {}),
    ...(scheduleName ? { scheduleName } : {}),
    notifyAt: notifyAt.toISOString(),
    status: "pending",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
  void environment;
}

async function markCheckoutConverted(
  tenantId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const token =
    (typeof payload.checkout_token === "string" && payload.checkout_token) ||
    (typeof payload.cart_token === "string" && payload.cart_token) ||
    "";
  if (!token) return;
  const existing = await getShopifyCheckout(tenantId, token);
  if (!existing) return;
  await cancelAbandonedCheckoutSchedule(existing.scheduleName);
  await putShopifyCheckout({
    ...existing,
    status: "converted",
    updatedAt: new Date().toISOString(),
  });
}

async function handleOrderPaid(
  tenantId: string,
  config: ShopifyConfig,
  payload: Record<string, unknown>,
  environment: string
): Promise<void> {
  await markCheckoutConverted(tenantId, payload);
  const { phone, name } = extractPhoneFromShopifyPayload(payload, config.defaultCountry);
  if (!phone) return;
  await sendShopifyWhatsAppTemplate({
    tenantId,
    config,
    event: "order_paid",
    phone,
    variables: {
      name: name || "cliente",
      order_number: String(payload.name ?? payload.order_number ?? payload.id ?? ""),
      total: money(payload),
      status: "confirmado",
      tracking_number: "",
      tracking_url: "",
      checkout_url: "",
    },
    shopifyResourceId: String(payload.id ?? ""),
    environment,
  });
}

async function handleOrderCancelled(
  tenantId: string,
  config: ShopifyConfig,
  payload: Record<string, unknown>,
  environment: string
): Promise<void> {
  await markCheckoutConverted(tenantId, payload);
  const { phone, name } = extractPhoneFromShopifyPayload(payload, config.defaultCountry);
  if (!phone) return;
  await sendShopifyWhatsAppTemplate({
    tenantId,
    config,
    event: "order_cancelled",
    phone,
    variables: {
      name: name || "cliente",
      order_number: String(payload.name ?? payload.order_number ?? payload.id ?? ""),
      total: money(payload),
      status: "cancelado",
      tracking_number: "",
      tracking_url: "",
      checkout_url: "",
    },
    shopifyResourceId: String(payload.id ?? ""),
    environment,
  });
}

async function handleFulfillment(
  tenantId: string,
  config: ShopifyConfig,
  payload: Record<string, unknown>,
  environment: string
): Promise<void> {
  const trackingNumber =
    (typeof payload.tracking_number === "string" && payload.tracking_number) ||
    (Array.isArray(payload.tracking_numbers)
      ? String(payload.tracking_numbers[0] ?? "")
      : "");
  if (!trackingNumber) return;

  const trackingUrl =
    (typeof payload.tracking_url === "string" && payload.tracking_url) ||
    (Array.isArray(payload.tracking_urls) ? String(payload.tracking_urls[0] ?? "") : "");

  const { phone, name } = extractPhoneFromShopifyPayload(payload, config.defaultCountry);
  const order = asRecord(payload.order);
  const phoneFallback =
    phone ||
    extractPhoneFromShopifyPayload(order, config.defaultCountry).phone;
  if (!phoneFallback) return;

  await sendShopifyWhatsAppTemplate({
    tenantId,
    config,
    event: "fulfillment_shipped",
    phone: phoneFallback,
    variables: {
      name: name || extractPhoneFromShopifyPayload(order, config.defaultCountry).name || "cliente",
      order_number: String(payload.order_id ?? order.name ?? order.order_number ?? ""),
      total: money(order),
      status: "enviado",
      tracking_number: trackingNumber,
      tracking_url: trackingUrl,
      checkout_url: "",
    },
    shopifyResourceId: String(payload.id ?? ""),
    environment,
  });
}

async function handleUninstall(tenantId: string, environment: string): Promise<void> {
  await deleteShopifyShopTokens(tenantId, environment);
  await deleteShopifyCheckoutsForTenant(tenantId);
  await deleteShopifyDeliveriesForTenant(tenantId);
  await deleteShopifyConfig(tenantId);
}

export async function processShopifyWebhookEvent(params: {
  tenantId: string;
  topic: string;
  payload: Record<string, unknown>;
  environment: string;
}): Promise<void> {
  const { tenantId, topic, payload, environment } = params;

  if (topic === "app/uninstalled" || topic === "shop/redact") {
    await handleUninstall(tenantId, environment);
    return;
  }

  if (topic === "customers/data_request") {
    return;
  }

  if (topic === "customers/redact") {
    const customer = asRecord(payload.customer);
    const phone = extractPhoneFromShopifyPayload(
      { ...payload, ...customer },
      "CO"
    ).phone;
    if (phone) {
      await deleteShopifyCheckoutsByPhone(tenantId, phone);
      await deleteShopifyDeliveriesByPhone(tenantId, phone);
    }
    return;
  }

  const config = await getShopifyConfig(tenantId);
  if (!config?.enabled || config.status !== "connected") return;

  if (topic === "checkouts/create" || topic === "checkouts/update") {
    await handleCheckoutEvent(tenantId, config, payload, environment);
    return;
  }
  if (topic === "orders/create") {
    await markCheckoutConverted(tenantId, payload);
    return;
  }
  if (topic === "orders/paid") {
    await handleOrderPaid(tenantId, config, payload, environment);
    return;
  }
  if (topic === "orders/cancelled") {
    await handleOrderCancelled(tenantId, config, payload, environment);
    return;
  }
  if (topic === "fulfillments/create" || topic === "fulfillments/update") {
    await handleFulfillment(tenantId, config, payload, environment);
  }
}

export async function processAbandonedCheckoutJob(params: {
  tenantId: string;
  checkoutToken: string;
  environment: string;
}): Promise<void> {
  const config = await getShopifyConfig(params.tenantId);
  if (!config?.enabled || config.status !== "connected") return;

  const checkout = await getShopifyCheckout(params.tenantId, params.checkoutToken);
  if (!checkout || checkout.status !== "pending" || !checkout.phone) return;

  const tokens = await getShopifyShopTokens(params.tenantId, params.environment);
  if (tokens) {
    try {
      const accessToken = await resolveShopifyAccessToken(
        params.tenantId,
        config.shopDomain,
        params.environment
      );
      const live = await getCheckout(config.shopDomain, accessToken, params.checkoutToken);
      if (live && live.completed_at) {
        await putShopifyCheckout({
          ...checkout,
          status: "converted",
          updatedAt: new Date().toISOString(),
        });
        return;
      }
    } catch {
      // continue with local checkout state
    }
  }

  const result = await sendShopifyWhatsAppTemplate({
    tenantId: params.tenantId,
    config,
    event: "abandoned_checkout",
    phone: checkout.phone,
    variables: {
      name: checkout.customerName || "cliente",
      order_number: "",
      total: checkout.totalPrice || "",
      status: "abandonado",
      tracking_number: "",
      tracking_url: "",
      checkout_url: checkout.abandonedCheckoutUrl || "",
    },
    shopifyResourceId: checkout.checkoutToken,
    environment: params.environment,
  });

  if (result === "sent" || result === "skipped") {
    await putShopifyCheckout({
      ...checkout,
      status: result === "sent" ? "notified" : checkout.status,
      ...(result === "sent" ? { notifiedAt: new Date().toISOString() } : {}),
      updatedAt: new Date().toISOString(),
    });
  }
}
