import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { getBot } from "../../lib/dynamodb/bot.repository.js";
import { getBotByEmailAddress } from "../../lib/dynamodb/bot-lookup.repository.js";
import { parseSesInboundNotification } from "../../lib/email/inbound.js";
import { conversationLookupGsi1pk } from "../../lib/channels/keys.js";
import { handleError } from "../../lib/http.js";
import type { InboundQueueMessage } from "../../types/index.js";

const sqs = new SQSClient({});
const QUEUE_URL = process.env.SQS_QUEUE_URL ?? "";

interface SnsEnvelope {
  Type: string;
  Message?: string;
  SubscribeURL?: string;
}

export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  try {
    const body = JSON.parse(event.body ?? "{}") as SnsEnvelope;

    if (body.Type === "SubscriptionConfirmation" && body.SubscribeURL) {
      await fetch(body.SubscribeURL);
      return { statusCode: 200, body: "OK" };
    }

    if (body.Type !== "Notification" || !body.Message) {
      return { statusCode: 200, body: "OK" };
    }

    const emailPayload = parseSesInboundNotification(body.Message);
    if (!emailPayload) {
      return { statusCode: 200, body: "OK" };
    }

    const lookup = await getBotByEmailAddress(emailPayload.to);
    if (!lookup) {
      console.log(`No bot for email address: ${emailPayload.to}`);
      return { statusCode: 200, body: "OK" };
    }

    const bot = await getBot(lookup.tenantId, lookup.botId);
    if (!bot?.emailEnabled || bot.status !== "active") {
      return { statusCode: 200, body: "OK" };
    }

    const participantId = emailPayload.from;
    const conversationKey = conversationLookupGsi1pk(
      lookup.tenantId,
      lookup.botId,
      "email",
      participantId
    );

    const sqsBody: InboundQueueMessage = {
      channel: "email",
      tenantId: lookup.tenantId,
      botId: lookup.botId,
      participantId,
      conversationKey,
      replyToExternalId: emailPayload.messageId,
      payload: emailPayload,
    };

    await sqs.send(
      new SendMessageCommand({
        QueueUrl: QUEUE_URL,
        MessageBody: JSON.stringify(sqsBody),
        MessageGroupId: conversationKey,
        MessageDeduplicationId: emailPayload.messageId,
      })
    );

    return { statusCode: 200, body: "OK" };
  } catch (error) {
    return handleError(error);
  }
}
