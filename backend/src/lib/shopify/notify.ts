import { getBot } from "../dynamodb/bot.repository.js";
import { putShopifyDelivery } from "../dynamodb/shopify.repository.js";
import { getWhatsAppAccessToken, sendTemplateMessage } from "../whatsapp/client.js";
import { assertWhatsAppOutboundAllowed } from "../whatsapp/outbound-guard.js";
import type {
  ShopifyConfig,
  ShopifyNotificationEvent,
  WhatsAppOutboundSendKind,
} from "../../types/index.js";

const EVENT_KIND: Record<ShopifyNotificationEvent, WhatsAppOutboundSendKind> = {
  abandoned_checkout: "marketing",
  order_paid: "transactional",
  order_cancelled: "transactional",
  fulfillment_shipped: "transactional",
};

export async function sendShopifyWhatsAppTemplate(params: {
  tenantId: string;
  config: ShopifyConfig;
  event: ShopifyNotificationEvent;
  phone: string;
  variables: Record<string, string>;
  shopifyResourceId?: string;
  environment: string;
}): Promise<"sent" | "skipped" | "failed"> {
  const mapping = params.config.templates[params.event];
  if (!mapping?.templateName || !params.config.botId) {
    await putShopifyDelivery({
      tenantId: params.tenantId,
      event: params.event,
      phone: params.phone,
      status: "skipped",
      reason: "template_or_bot_missing",
      ...(params.shopifyResourceId ? { shopifyResourceId: params.shopifyResourceId } : {}),
    });
    return "skipped";
  }

  const bot = await getBot(params.tenantId, params.config.botId);
  if (!bot?.phoneNumberId) {
    await putShopifyDelivery({
      tenantId: params.tenantId,
      event: params.event,
      phone: params.phone,
      templateName: mapping.templateName,
      status: "skipped",
      reason: "bot_phone_missing",
      ...(params.shopifyResourceId ? { shopifyResourceId: params.shopifyResourceId } : {}),
    });
    return "skipped";
  }

  const accessToken = await getWhatsAppAccessToken(params.tenantId, params.environment);
  if (!accessToken) {
    await putShopifyDelivery({
      tenantId: params.tenantId,
      event: params.event,
      phone: params.phone,
      templateName: mapping.templateName,
      status: "failed",
      reason: "whatsapp_token_missing",
      ...(params.shopifyResourceId ? { shopifyResourceId: params.shopifyResourceId } : {}),
    });
    return "failed";
  }

  const kind = EVENT_KIND[params.event];
  try {
    await assertWhatsAppOutboundAllowed({
      tenantId: params.tenantId,
      phoneNumberId: bot.phoneNumberId,
      kind,
      to: params.phone,
      requireOptIn: kind === "marketing",
    });

    const bodyParams = (mapping.variableKeys.length
      ? mapping.variableKeys
      : Object.keys(params.variables)
    ).map((key) => ({
      type: "text" as const,
      text: params.variables[key] ?? "",
    }));

    await sendTemplateMessage({
      phoneNumberId: bot.phoneNumberId,
      to: params.phone,
      templateName: mapping.templateName,
      language: mapping.templateLanguage || "es",
      accessToken,
      ...(bodyParams.length
        ? {
            components: [
              {
                type: "body",
                parameters: bodyParams,
              },
            ],
          }
        : {}),
    });

    await putShopifyDelivery({
      tenantId: params.tenantId,
      event: params.event,
      phone: params.phone,
      templateName: mapping.templateName,
      status: "sent",
      ...(params.shopifyResourceId ? { shopifyResourceId: params.shopifyResourceId } : {}),
    });
    return "sent";
  } catch (error) {
    const reason = error instanceof Error ? error.message : "send_failed";
    await putShopifyDelivery({
      tenantId: params.tenantId,
      event: params.event,
      phone: params.phone,
      templateName: mapping.templateName,
      status: reason.includes("marketing_opt_in") || reason.includes("opt_in")
        ? "skipped"
        : "failed",
      reason,
      ...(params.shopifyResourceId ? { shopifyResourceId: params.shopifyResourceId } : {}),
    });
    return reason.includes("marketing_opt_in") || reason.includes("opt_in")
      ? "skipped"
      : "failed";
  }
}
