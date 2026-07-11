import { buildOutboundContext, sendChannelText } from "../channels/router.js";
import { getOrCreateConversation } from "../dynamodb/conversation.repository.js";
import { loadBotAndToken } from "../whatsapp/bot-context.js";
import type { Bot, Conversation } from "../../types/index.js";
import { formatPaymentMessage } from "./checkout.js";

export async function sendPaymentLinkMessage(params: {
  tenantId: string;
  botId: string;
  contactPhone: string;
  contactName?: string;
  amountInCents: number;
  description: string;
  checkoutUrl: string;
  messageTemplate?: string;
  environment: string;
}): Promise<{ conversation: Conversation; bot: Bot }> {
  const { bot, accessToken } = await loadBotAndToken(
    params.tenantId,
    params.botId,
    params.environment
  );

  const conversation = await getOrCreateConversation(
    params.tenantId,
    params.botId,
    "whatsapp",
    params.contactPhone,
    params.contactName
  );

  const text = formatPaymentMessage(
    params.messageTemplate,
    params.checkoutUrl,
    params.amountInCents,
    params.description
  );

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

  return { conversation, bot };
}

export async function sendPaymentConfirmationMessage(params: {
  tenantId: string;
  botId: string;
  contactPhone: string;
  amountInCents: number;
  description: string;
  environment: string;
}): Promise<void> {
  const { bot, accessToken } = await loadBotAndToken(
    params.tenantId,
    params.botId,
    params.environment
  );

  const conversation = await getOrCreateConversation(
    params.tenantId,
    params.botId,
    "whatsapp",
    params.contactPhone
  );

  const amountFormatted = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(params.amountInCents / 100);

  await sendChannelText(
    buildOutboundContext({
      tenantId: params.tenantId,
      botId: params.botId,
      bot,
      conversation,
      accessToken,
      environment: params.environment,
    }),
    `Pago confirmado: ${amountFormatted} por ${params.description}. Gracias.`
  );
}
