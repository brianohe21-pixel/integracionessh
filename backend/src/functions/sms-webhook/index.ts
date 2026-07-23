import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { getBot } from "../../lib/dynamodb/bot.repository.js";
import { getBotBySmsNumber } from "../../lib/dynamodb/bot-lookup.repository.js";
import { parseSnsSmsBody } from "../../lib/sms/inbound.js";
import { conversationLookupGsi1pk } from "../../lib/channels/keys.js";
import { handleError } from "../../lib/http.js";
import type { InboundQueueMessage, SmsInboundPayload } from "../../types/index.js";

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

    const smsEvent = parseSnsSmsBody(body.Message);
    if (!smsEvent) {
      return { statusCode: 200, body: "OK" };
    }

    const lookup = await getBotBySmsNumber(smsEvent.destinationNumber);
    if (!lookup) {
      console.log(`No bot for SMS number: ${smsEvent.destinationNumber}`);
      return { statusCode: 200, body: "OK" };
    }

    const bot = await getBot(lookup.tenantId, lookup.botId);
    if (!bot?.smsEnabled || bot.status !== "active") {
      return { statusCode: 200, body: "OK" };
    }

    const participantId = smsEvent.originationNumber;
    const payload: SmsInboundPayload = {
      originationNumber: smsEvent.originationNumber,
      destinationNumber: smsEvent.destinationNumber,
      messageBody: smsEvent.messageBody,
      inboundMessageId: smsEvent.inboundMessageId,
    };

    const conversationKey = conversationLookupGsi1pk(
      lookup.tenantId,
      lookup.botId,
      "sms",
      participantId
    );

    const sqsBody: InboundQueueMessage = {
      channel: "sms",
      tenantId: lookup.tenantId,
      botId: lookup.botId,
      participantId,
      conversationKey,
      replyToExternalId: smsEvent.inboundMessageId,
      payload,
    };

    await sqs.send(
      new SendMessageCommand({
        QueueUrl: QUEUE_URL,
        MessageBody: JSON.stringify(sqsBody),
        MessageGroupId: conversationKey,
        MessageDeduplicationId: smsEvent.inboundMessageId,
      })
    );

    return { statusCode: 200, body: "OK" };
  } catch (error) {
    return handleError(error);
  }
}
