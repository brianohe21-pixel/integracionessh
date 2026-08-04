import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { getBot } from "../../lib/dynamodb/bot.repository.js";
import { getBotBySmsNumber } from "../../lib/dynamodb/bot-lookup.repository.js";
import { parseSnsSmsBody } from "../../lib/sms/inbound.js";
import { conversationLookupGsi1pk } from "../../lib/channels/keys.js";
import { handleError } from "../../lib/http.js";
import { parseTelcoredDlrQuery } from "../../lib/sms/dlr.js";
import { applySmsDlrCallback } from "../../lib/dynamodb/sms-dlr.repository.js";
import type { InboundQueueMessage, SmsInboundPayload } from "../../types/index.js";

const sqs = new SQSClient({});
const QUEUE_URL = process.env.SQS_QUEUE_URL ?? "";

interface SnsEnvelope {
  Type: string;
  Message?: string;
  SubscribeURL?: string;
}

async function handleSmsDlrCallback(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  const callback = parseTelcoredDlrQuery(event.queryStringParameters ?? {});
  if (!callback) {
    return { statusCode: 400, body: "Missing receiptId" };
  }

  const result = await applySmsDlrCallback(callback);
  if (result === "not_found") {
    return { statusCode: 404, body: "Receipt not found" };
  }

  return { statusCode: 200, body: "OK" };
}

async function handleInboundSmsWebhook(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
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
}

export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  try {
    const method = event.requestContext.http.method;
    const path = event.rawPath ?? event.requestContext.http.path ?? "";

    if (method === "GET" && path.endsWith("/sms/dlr")) {
      return handleSmsDlrCallback(event);
    }

    if (method === "POST" && path.endsWith("/sms/webhook")) {
      return handleInboundSmsWebhook(event);
    }

    return { statusCode: 404, body: "Not found" };
  } catch (error) {
    return handleError(error);
  }
}
