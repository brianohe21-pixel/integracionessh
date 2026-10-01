import type { Context, SQSBatchResponse, SQSEvent } from "aws-lambda";
import {
  processAbandonedCheckoutJob,
  processShopifyWebhookEvent,
} from "../../lib/shopify/process-event.js";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";

interface SchedulerPayload {
  action?: string;
  tenantId?: string;
  checkoutToken?: string;
}

interface WebhookQueueMessage {
  type?: string;
  tenantId?: string;
  topic?: string;
  payload?: Record<string, unknown>;
}

export async function handler(
  event: SQSEvent | SchedulerPayload,
  _context: Context
): Promise<SQSBatchResponse | void> {
  if (event && "action" in event && event.action === "abandoned-checkout") {
    const tenantId = event.tenantId?.trim() ?? "";
    const checkoutToken = event.checkoutToken?.trim() ?? "";
    if (tenantId && checkoutToken) {
      await processAbandonedCheckoutJob({
        tenantId,
        checkoutToken,
        environment: ENVIRONMENT,
      });
    }
    return;
  }

  const sqsEvent = event as SQSEvent;
  if (!sqsEvent.Records?.length) return { batchItemFailures: [] };

  const batchItemFailures: Array<{ itemIdentifier: string }> = [];

  for (const record of sqsEvent.Records) {
    try {
      const message = JSON.parse(record.body) as WebhookQueueMessage;
      if (message.type !== "webhook" || !message.tenantId || !message.topic) {
        continue;
      }
      await processShopifyWebhookEvent({
        tenantId: message.tenantId,
        topic: message.topic,
        payload: message.payload ?? {},
        environment: ENVIRONMENT,
      });
    } catch (error) {
      console.error("process-shopify failed", { messageId: record.messageId, error });
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
}
