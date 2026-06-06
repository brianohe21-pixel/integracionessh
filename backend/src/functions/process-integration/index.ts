import type { SQSEvent, SQSRecord } from "aws-lambda";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { randomUUID } from "crypto";
import {
  getTenantIntegration,
  updateIntegrationDelivery,
} from "../../lib/dynamodb/integration.repository.js";
import {
  deliverIntegrationEvent,
  retryDelayMs,
  shouldRetryDelivery,
} from "../../lib/integrations/deliver.js";
import type { IntegrationEventPayload, IntegrationQueueMessage } from "../../types/index.js";

const sqs = new SQSClient({});
const QUEUE_URL = process.env.INTEGRATION_SQS_QUEUE_URL ?? "";

export async function handler(event: SQSEvent): Promise<void> {
  for (const record of event.Records) {
    await processRecord(record);
  }
}

async function processRecord(record: SQSRecord): Promise<void> {
  let message: IntegrationQueueMessage & { createdAt?: string };
  try {
    message = JSON.parse(record.body) as IntegrationQueueMessage & { createdAt?: string };
  } catch {
    console.error("Invalid integration queue message", record.body);
    return;
  }

  const { tenantId, deliveryId, payload, attempt } = message;
  const createdAt = message.createdAt ?? payload.timestamp;

  const integration = await getTenantIntegration(tenantId);
  if (!integration?.enabled || !integration.webhookUrl) {
    await updateIntegrationDelivery(tenantId, createdAt, deliveryId, {
      status: "failed",
      attempts: attempt,
      lastError: "Integration not configured",
    });
    return;
  }

  try {
    await deliverIntegrationEvent(integration, payload as IntegrationEventPayload);
    await updateIntegrationDelivery(tenantId, createdAt, deliveryId, {
      status: "delivered",
      attempts: attempt,
    });
  } catch (error) {
    const errMsg = (error as Error).message ?? "Delivery failed";
    console.error(`Integration delivery failed tenant=${tenantId} attempt=${attempt}:`, errMsg);

    if (shouldRetryDelivery(attempt) && QUEUE_URL) {
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs(attempt)));
      await sqs.send(
        new SendMessageCommand({
          QueueUrl: QUEUE_URL,
          MessageBody: JSON.stringify({
            ...message,
            attempt: attempt + 1,
            createdAt,
          }),
          MessageGroupId: tenantId,
          MessageDeduplicationId: `retry-${deliveryId}-${attempt + 1}-${randomUUID()}`,
          DelaySeconds: Math.min(Math.floor(retryDelayMs(attempt) / 1000), 900),
        })
      );
      await updateIntegrationDelivery(tenantId, createdAt, deliveryId, {
        attempts: attempt,
        lastError: errMsg,
      });
      return;
    }

    await updateIntegrationDelivery(tenantId, createdAt, deliveryId, {
      status: "failed",
      attempts: attempt,
      lastError: errMsg,
    });
  }
}
