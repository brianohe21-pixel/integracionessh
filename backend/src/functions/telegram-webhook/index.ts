import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { getBot } from "../../lib/dynamodb/bot.repository.js";
import { getBotByTelegramBotId } from "../../lib/dynamodb/bot-lookup.repository.js";
import { getTelegramWebhookSecret } from "../../lib/telegram/secrets.js";
import { isProcessableTelegramMessage } from "../../lib/telegram/inbound.js";
import { conversationLookupGsi1pk } from "../../lib/channels/keys.js";
import { badRequest, notFound, unauthorized, handleError } from "../../lib/http.js";
import type { InboundQueueMessage, TelegramInboundPayload } from "../../types/index.js";

const sqs = new SQSClient({});
const QUEUE_URL = process.env.SQS_QUEUE_URL ?? "";
const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; username?: string; first_name?: string };
    chat: { id: number };
    text?: string;
  };
}

export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  try {
    if (event.requestContext.http.method !== "POST") {
      return badRequest("Method not allowed");
    }

    const botId = event.pathParameters?.botId;
    if (!botId) return badRequest("Missing botId");

    const lookup = await getBotByTelegramBotId(botId);
    if (!lookup) return notFound("Bot not found");

    const secretHeader = event.headers["x-telegram-bot-api-secret-token"] ?? "";
    const webhookSecret = await getTelegramWebhookSecret(
      lookup.tenantId,
      botId,
      ENVIRONMENT
    );
    if (secretHeader !== webhookSecret) {
      return unauthorized("Invalid webhook secret");
    }

    const body = JSON.parse(event.body ?? "{}") as TelegramUpdate;
    const message = body.message;
    if (!message?.text || !message.from) {
      return { statusCode: 200, body: "OK" };
    }

    const payload: TelegramInboundPayload = {
      updateId: body.update_id,
      chatId: String(message.chat.id),
      messageId: message.message_id,
      text: message.text,
      ...(message.from.username ? { fromUsername: message.from.username } : {}),
      ...(message.from.first_name ? { fromFirstName: message.from.first_name } : {}),
    };

    if (!isProcessableTelegramMessage(payload)) {
      return { statusCode: 200, body: "OK" };
    }

    const bot = await getBot(lookup.tenantId, botId);
    if (!bot?.telegramEnabled || bot.status !== "active") {
      return { statusCode: 200, body: "OK" };
    }

    const participantId = String(message.chat.id);
    const conversationKey = conversationLookupGsi1pk(
      lookup.tenantId,
      botId,
      "telegram",
      participantId
    );

    const sqsBody: InboundQueueMessage = {
      channel: "telegram",
      tenantId: lookup.tenantId,
      botId,
      participantId,
      conversationKey,
      ...(message.from.first_name ? { displayName: message.from.first_name } : {}),
      replyToExternalId: String(message.message_id),
      payload,
    };

    await sqs.send(
      new SendMessageCommand({
        QueueUrl: QUEUE_URL,
        MessageBody: JSON.stringify(sqsBody),
        MessageGroupId: conversationKey,
        MessageDeduplicationId: `tg-${message.message_id}`,
      })
    );

    return { statusCode: 200, body: "OK" };
  } catch (error) {
    return handleError(error);
  }
}
