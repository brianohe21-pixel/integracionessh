import { emitIntegrationEvent } from "../integrations/emit.js";
import { buildOrderCreatedPayload } from "../integrations/payloads.js";
import { addMessage, getConversation } from "../dynamodb/conversation.repository.js";
import { getPaymentsConfig } from "../dynamodb/payments-config.repository.js";
import { createPaymentRequest } from "../payments/payments.service.js";
import { resumeFlowRunOnOrder } from "../flow/interpreter.js";
import { buildOutboundContext, sendChannelText } from "../channels/router.js";
import { getBot } from "../dynamodb/bot.repository.js";
import { getWhatsAppAccessToken } from "../whatsapp/client.js";
import {
  createOrderFromWebhook as persistOrder,
  getCatalogConfigForBot,
} from "./catalog.service.js";
import { formatOrderConfirmationMessage } from "./notify.js";
import type { InboundNormalized, WhatsAppOrderPayload } from "../../types/index.js";

export interface HandleInboundOrderParams {
  tenantId: string;
  botId: string;
  conversationId: string;
  contactPhone: string;
  contactName?: string;
  whatsappMessageId: string;
  order: WhatsAppOrderPayload;
  environment: string;
}

export async function handleInboundOrder(
  params: HandleInboundOrderParams
): Promise<{ handled: boolean; orderId?: string }> {
  const config = await getCatalogConfigForBot(params.tenantId, params.botId);
  if (!config?.enabled) {
    return { handled: false };
  }

  if (config.metaCatalogId && params.order.catalog_id !== config.metaCatalogId) {
    console.warn(
      `Order catalog_id mismatch for bot ${params.botId}: expected ${config.metaCatalogId}, got ${params.order.catalog_id}`
    );
    return { handled: false };
  }

  const { getTenant } = await import("../dynamodb/tenant.repository.js");
  const { assertCanCreateOrder } = await import("../billing/assert-plan.js");
  const { PlanLimitError } = await import("../billing/plan-limits.js");
  const tenant = await getTenant(params.tenantId);
  if (tenant) {
    try {
      await assertCanCreateOrder(tenant);
    } catch (err) {
      if (err instanceof PlanLimitError) {
        console.warn(`Order limit for tenant ${params.tenantId}:`, err.message);
        return { handled: true };
      }
      throw err;
    }
  }

  const order = await persistOrder({
    tenantId: params.tenantId,
    botId: params.botId,
    conversationId: params.conversationId,
    contactPhone: params.contactPhone,
    ...(params.contactName ? { contactName: params.contactName } : {}),
    orderPayload: params.order,
    whatsappMessageId: params.whatsappMessageId,
    source: "whatsapp_cart",
  });

  const confirmationText = formatOrderConfirmationMessage(
    config.orderConfirmationMessage,
    order
  );

  const bot = await getBot(params.tenantId, params.botId);
  if (bot) {
    const accessToken = await getWhatsAppAccessToken(params.tenantId, params.environment);
    const conversation = await getConversation(
      params.tenantId,
      params.botId,
      params.conversationId
    );
    if (accessToken && conversation) {
      await sendChannelText(
        buildOutboundContext({
          tenantId: params.tenantId,
          botId: params.botId,
          bot,
          conversation,
          accessToken,
          environment: params.environment,
          replyToExternalId: params.whatsappMessageId,
        }),
        confirmationText
      );

      await addMessage(
        {
          messageId: `order-confirm-${order.orderId}`,
          conversationId: params.conversationId,
          tenantId: params.tenantId,
          role: "assistant",
          content: confirmationText,
          channel: "whatsapp",
          messageType: "text",
          source: "whatsapp_inbound",
          timestamp: new Date().toISOString(),
        },
        params.botId
      );
    }
  }

  if (config.autoCollectPayment && order.subtotalInCents >= 1000) {
    const paymentsConfig = await getPaymentsConfig(params.tenantId, params.botId);
    if (paymentsConfig?.enabled) {
      try {
        const payment = await createPaymentRequest({
          tenantId: params.tenantId,
          botId: params.botId,
          amountInCents: order.subtotalInCents,
          description: `Pedido #${order.orderId.slice(0, 8)}`,
          contactPhone: params.contactPhone,
          ...(params.contactName ? { contactName: params.contactName } : {}),
          source: "catalog_order",
          conversationId: params.conversationId,
          environment: params.environment,
          sendWhatsApp: true,
        });
        const { updateOrder } = await import("../dynamodb/order.repository.js");
        await updateOrder(params.tenantId, order.orderId, { paymentId: payment.paymentId });
        order.paymentId = payment.paymentId;
      } catch (err) {
        console.error("Failed to create payment for order:", err);
      }
    }
  }

  await emitIntegrationEvent(
    params.tenantId,
    "order.created",
    buildOrderCreatedPayload({
      tenantId: params.tenantId,
      botId: params.botId,
      order,
    })
  ).catch((err) => console.error("Failed to emit order.created:", err));

  await resumeFlowRunOnOrder({
    tenantId: params.tenantId,
    botId: params.botId,
    conversationId: params.conversationId,
    orderId: order.orderId,
    subtotalInCents: order.subtotalInCents,
    itemsCount: order.items.length,
  }).catch((err) => console.error("Failed to resume flow on order:", err));

  return { handled: true, orderId: order.orderId };
}

export function isOrderInbound(inbound: InboundNormalized): boolean {
  return inbound.messageType === "order" && Boolean(inbound.order);
}

export function formatOrderMessageText(order: WhatsAppOrderPayload): string {
  const items = order.product_items
    .map((item) => {
      const qty = Number(item.quantity);
      const price = Number(item.item_price);
      return `${qty}x ${item.product_retailer_id} (${item.currency} ${price})`;
    })
    .join(", ");
  const note = order.text?.trim();
  return note ? `Pedido: ${items}\n${note}` : `Pedido: ${items}`;
}
