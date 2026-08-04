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
}): Promise<{ messageId: string; text: string; receiptId?: string }> {
  await assertSmsBotReady(params.bot);

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
  const normalizedTo = params.to.replace(/\D/g, "");
  const source = params.source ?? "template";

  let receiptId: string | undefined;
  let dlrUrl: string | undefined;

  if (params.requestDlr) {
    const apiPublicUrl = assertApiPublicUrlConfigured();
    const receipt = await createSmsDlrReceipt({
      tenantId: params.tenantId,
      botId: params.botId,
      source,
      to: normalizedTo,
      templateName: params.templateName,
      language: params.language,
      ...(params.campaignId ? { campaignId: params.campaignId } : {}),
    });
    receiptId = receipt.receiptId;
    dlrUrl = buildTelcoredDlrUrl(receipt.receiptId, apiPublicUrl);
  }

  try {
    const result = await sendSmsTextMessage({
      phoneNumber: normalizedTo,
      text,
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
      text,
      ...(receiptId ? { receiptId } : {}),
    };
  } catch (error) {
    if (receiptId) {
      const message = error instanceof Error ? error.message : String(error);
      await markSmsDlrReceiptSendError(receiptId, message).catch((markError) => {
        console.warn(`Failed to mark SMS DLR send error for ${receiptId}:`, markError);
      });
    }
    throw error;
  }
}
