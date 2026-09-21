import type { Bot } from "../../types/index.js";
import type { OutreachChannel } from "../../types/index.js";
import { getBot } from "../dynamodb/bot.repository.js";
import { sendSmsTextWithDlr } from "../sms/send-outbound.js";
import { sendTemplateMessage, sendTextMessage } from "../whatsapp/client.js";
import { assertWhatsAppOutboundAllowed } from "../whatsapp/outbound-guard.js";
import { renderOtpMessage } from "./crypto.js";

export interface SendOtpChannelParams {
  tenantId: string;
  botId: string;
  channel: OutreachChannel;
  to: string;
  code: string;
  messageTemplate?: string;
  whatsappTemplate?: {
    name: string;
    language: string;
  };
  accessToken?: string;
  environment?: string;
}

export interface SendOtpChannelResult {
  messageId: string;
  channel: OutreachChannel;
  text?: string;
  receiptId?: string;
}

const DEFAULT_OTP_MESSAGE =
  "Tu codigo de verificacion es {{code}}. Expira en 5 minutos.";

async function loadBot(tenantId: string, botId: string): Promise<Bot> {
  const bot = await getBot(tenantId, botId);
  if (!bot) {
    throw Object.assign(new Error("Bot not found"), { statusCode: 404 });
  }
  if (bot.status !== "active") {
    throw Object.assign(new Error("Bot is inactive"), { statusCode: 403 });
  }
  return bot;
}

export async function sendOtpViaChannel(
  params: SendOtpChannelParams
): Promise<SendOtpChannelResult> {
  const bot = await loadBot(params.tenantId, params.botId);
  const normalizedTo = params.to.replace(/\D/g, "");

  if (params.channel === "sms") {
    const text = renderOtpMessage(params.messageTemplate ?? DEFAULT_OTP_MESSAGE, params.code);
    const result = await sendSmsTextWithDlr({
      tenantId: params.tenantId,
      bot,
      botId: params.botId,
      to: normalizedTo,
      text,
      ...(params.environment ? { environment: params.environment } : {}),
    });

    return {
      messageId: result.messageId,
      channel: "sms",
      text: result.text,
      receiptId: result.receiptId,
    };
  }

  if (!params.accessToken) {
    throw Object.assign(new Error("WhatsApp access token is required"), { statusCode: 500 });
  }

  if (params.whatsappTemplate?.name) {
    await assertWhatsAppOutboundAllowed({
      tenantId: params.tenantId,
      phoneNumberId: bot.phoneNumberId,
      kind: "transactional",
      to: normalizedTo,
    });

    const result = await sendTemplateMessage({
      phoneNumberId: bot.phoneNumberId,
      to: normalizedTo,
      templateName: params.whatsappTemplate.name,
      language: params.whatsappTemplate.language,
      accessToken: params.accessToken,
      components: [
        {
          type: "body",
          parameters: [{ type: "text", text: params.code }],
        },
      ],
    });

    return {
      messageId: result.messages[0]?.id ?? "",
      channel: "whatsapp",
    };
  }

  const text = renderOtpMessage(params.messageTemplate ?? DEFAULT_OTP_MESSAGE, params.code);
  await assertWhatsAppOutboundAllowed({
    tenantId: params.tenantId,
    phoneNumberId: bot.phoneNumberId,
    kind: "transactional",
    to: normalizedTo,
  });

  const result = await sendTextMessage({
    phoneNumberId: bot.phoneNumberId,
    to: normalizedTo,
    text,
    accessToken: params.accessToken,
  });

  return {
    messageId: result.messages[0]?.id ?? "",
    channel: "whatsapp",
    text,
  };
}
