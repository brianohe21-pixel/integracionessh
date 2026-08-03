import type { Bot } from "../../types/index.js";
import { sendSmsTextMessage } from "./client.js";
import { parametersFromComponents, renderTemplateBody } from "./render.js";
import { getSmsTemplate } from "../dynamodb/template.repository.js";

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
}): Promise<{ messageId: string; text: string }> {
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
  const result = await sendSmsTextMessage({
    phoneNumber: params.to,
    text,
    from: params.bot.smsOriginationNumber ?? "msg",
    ...(params.environment ? { environment: params.environment } : {}),
  });

  return { messageId: result.messageId, text };
}
