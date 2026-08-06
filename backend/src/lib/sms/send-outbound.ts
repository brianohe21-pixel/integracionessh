import type { Bot } from "../../types/index.js";
import { sendSmsTextMessage } from "./client.js";
import { parametersFromComponents, renderTemplateBody } from "./render.js";
import { getSmsTemplate } from "../dynamodb/template.repository.js";
import {
  createSmsDlrReceipt,
  markSmsDlrReceiptSendError,
  markSmsDlrReceiptSent,
} from "../dynamodb/sms-dlr.repository.js";
import { assertApiPublicUrlConfigured, buildTelcoredDlrUrl } from "./dlr.js";
import type { SmsDlrSource } from "../../types/index.js";

export async function assertSmsBotReady(bot: Bot): Promise<void> {
  if (!bot.smsEnabled) {
    throw Object.assign(new Error("SMS is not enabled for this bot"), { statusCode: 400 });
  }
  const sender = bot.smsOriginationNumber?.trim();
  if (!sender) {
    throw Object.assign(
      new Error("SMS sender label is not configured for this bot"),
      { statusCode: 400 }
    );
  }
}

async function deliverSms(params: {
  tenantId: string;
  bot: Bot;
  botId: string;
  to: string;
  text: string;
  environment?: string;
  requestDlr: boolean;
  source: SmsDlrSource;
  campaignId?: string;
  attemptId?: string;
  recipientKey?: string;
  templateName?: string;
  language?: string;
}): Promise<{ messageId: string; text: string; receiptId?: string }> {
  await assertSmsBotReady(params.bot);

  const normalizedTo = params.to.replace(/\D/g, "");
  let receiptId: string | undefined;
  let dlrUrl: string | undefined;

  if (params.requestDlr) {
    const apiPublicUrl = assertApiPublicUrlConfigured();
    const receipt = await createSmsDlrReceipt({
      tenantId: params.tenantId,
      botId: params.botId,
      source: params.source,
      to: normalizedTo,
      ...(params.campaignId ? { campaignId: params.campaignId } : {}),
      ...(params.attemptId ? { attemptId: params.attemptId } : {}),
      ...(params.recipientKey ? { recipientKey: params.recipientKey } : {}),
      ...(params.templateName ? { templateName: params.templateName } : {}),
      ...(params.language ? { language: params.language } : {}),
    });
    receiptId = receipt.receiptId;
    dlrUrl = buildTelcoredDlrUrl(receipt.receiptId, apiPublicUrl);
  }

  try {
    const result = await sendSmsTextMessage({
      phoneNumber: normalizedTo,
      text: params.text,
      from: params.bot.smsOriginationNumber ?? "msg",
      ...(params.environment ? { environment: params.environment } : {}),
      ...(dlrUrl ? { dlrUrl } : {}),
    });

    if (receiptId) {
      await markSmsDlrReceiptSent(receiptId, result.messageId).catch((error) => {
        console.warn(`Failed to update SMS DLR receipt ${receiptId}:`, error);
      });
    }

    return {
      messageId: result.messageId,
      text: params.text,
      ...(receiptId ? { receiptId } : {}),
    };
  } catch (error) {
    if (receiptId) {
      const message = error instanceof Error ? error.message : String(error);
      await markSmsDlrReceiptSendError(receiptId, message).catch((markError) => {
        console.warn(`Failed to mark SMS DLR send error for ${receiptId}:`, markError);
      });
      const enriched = error instanceof Error ? error : new Error(message);
      throw Object.assign(enriched, {
        receiptId,
        statusCode: (error as { statusCode?: number }).statusCode ?? 502,
      });
    }
    throw error;
  }
}

export async function sendSmsTextWithDlr(params: {
  tenantId: string;
  bot: Bot;
  botId: string;
  to: string;
  text: string;
  environment?: string;
}): Promise<{ messageId: string; text: string; receiptId: string }> {
  const result = await deliverSms({
    tenantId: params.tenantId,
    bot: params.bot,
    botId: params.botId,
    to: params.to,
    text: params.text,
    ...(params.environment ? { environment: params.environment } : {}),
    requestDlr: true,
    source: "api",
  });

  if (!result.receiptId) {
    throw Object.assign(new Error("Failed to create SMS trace record"), { statusCode: 500 });
  }

  return {
    messageId: result.messageId,
    text: result.text,
    receiptId: result.receiptId,
  };
}

export async function sendSmsFromTemplate(params: {
  tenantId: string;
  bot: Bot;
  botId: string;
  templateName: string;
  language: string;
  to: string;
  components?: Array<{
    type: string;
    parameters?: Array<{ type: string; text?: string; image?: { link: string } }>;
  }>;
  environment?: string;
  requestDlr?: boolean;
  source?: "campaign" | "template";
  campaignId?: string;
  attemptId?: string;
  recipientKey?: string;
}): Promise<{ messageId: string; text: string; receiptId?: string }> {
  const template = await getSmsTemplate(
    params.tenantId,
    params.botId,
    params.templateName,
    params.language
  );
  if (!template) {
    throw Object.assign(new Error("SMS template not found"), { statusCode: 404 });
  }

  const values = parametersFromComponents(params.components);
  const text = renderTemplateBody(template.body, values);

  return deliverSms({
    tenantId: params.tenantId,
    bot: params.bot,
    botId: params.botId,
    to: params.to,
    text,
    ...(params.environment ? { environment: params.environment } : {}),
    requestDlr: params.requestDlr ?? false,
    source: params.source ?? "template",
    templateName: params.templateName,
    language: params.language,
    ...(params.campaignId ? { campaignId: params.campaignId } : {}),
    ...(params.attemptId ? { attemptId: params.attemptId } : {}),
    ...(params.recipientKey ? { recipientKey: params.recipientKey } : {}),
  });
}
