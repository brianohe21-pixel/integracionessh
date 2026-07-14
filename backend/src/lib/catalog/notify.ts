import { buildOutboundContext, sendChannelText } from "../channels/router.js";
import { getBot } from "../dynamodb/bot.repository.js";
import { getConversation } from "../dynamodb/conversation.repository.js";
import { getWhatsAppAccessToken } from "../whatsapp/client.js";
import type { CatalogOrder, OrderStatus } from "../../types/index.js";

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "pendiente",
  confirmed: "confirmado",
  preparing: "en preparación",
  shipped: "enviado",
  delivered: "entregado",
  cancelled: "cancelado",
};

export function formatOrderStatusMessage(
  template: string | undefined,
  order: CatalogOrder,
  status: OrderStatus
): string {
  const statusLabel = STATUS_LABELS[status];
  const total = (order.subtotalInCents / 100).toLocaleString("es-CO", {
    style: "currency",
    currency: order.currency,
  });
  const defaultMessage = `Tu pedido #${order.orderId.slice(0, 8)} está ${statusLabel}. Total: ${total}.`;

  if (!template?.trim()) return defaultMessage;

  return template
    .replace(/\{\{order_id\}\}/g, order.orderId)
    .replace(/\{\{status\}\}/g, statusLabel)
    .replace(/\{\{total\}\}/g, total)
    .replace(/\{\{items_count\}\}/g, String(order.items.length));
}

export async function sendOrderStatusNotification(params: {
  tenantId: string;
  botId: string;
  order: CatalogOrder;
  status: OrderStatus;
  messageTemplate?: string;
  environment: string;
}): Promise<void> {
  const bot = await getBot(params.tenantId, params.botId);
  if (!bot) return;

  const accessToken = await getWhatsAppAccessToken(params.tenantId, params.environment);
  if (!accessToken) return;

  const conversation =
    params.order.conversationId
      ? await getConversation(params.tenantId, params.botId, params.order.conversationId)
      : null;
  if (!conversation) return;

  const text = formatOrderStatusMessage(params.messageTemplate, params.order, params.status);

  await sendChannelText(
    buildOutboundContext({
      tenantId: params.tenantId,
      botId: params.botId,
      bot,
      conversation,
      accessToken,
      environment: params.environment,
    }),
    text
  );
}

export function formatOrderConfirmationMessage(
  template: string | undefined,
  order: CatalogOrder
): string {
  const total = (order.subtotalInCents / 100).toLocaleString("es-CO", {
    style: "currency",
    currency: order.currency,
  });
  const itemsSummary = order.items
    .map((item) => `${item.quantity}x ${item.name}`)
    .join(", ");
  const defaultMessage = `¡Gracias por tu pedido! #${order.orderId.slice(0, 8)}\n${itemsSummary}\nTotal: ${total}`;

  if (!template?.trim()) return defaultMessage;

  return template
    .replace(/\{\{order_id\}\}/g, order.orderId)
    .replace(/\{\{total\}\}/g, total)
    .replace(/\{\{items\}\}/g, itemsSummary)
    .replace(/\{\{items_count\}\}/g, String(order.items.length));
}
