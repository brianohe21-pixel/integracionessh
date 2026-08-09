import type { SQSBatchResponse, SQSEvent } from "aws-lambda";
import { processMailrelaySync } from "../../lib/mailrelay/sync.service.js";
import type { MailrelaySyncQueueMessage } from "../../types/index.js";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";
const SYNC_QUEUE_URL = process.env.MAILRELAY_SYNC_QUEUE_URL ?? "";

export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  const batchItemFailures: Array<{ itemIdentifier: string }> = [];
  for (const record of event.Records) {
    try {
      const message = JSON.parse(record.body) as MailrelaySyncQueueMessage;
      if (!message.tenantId || !message.jobId) throw new Error("Invalid Mailrelay sync message");
      await processMailrelaySync(message.tenantId, message.jobId, ENVIRONMENT, {
        ...(message.cursor ? { cursor: message.cursor } : {}),
        queueUrl: SYNC_QUEUE_URL,
      });
    } catch (error) {
      console.error("Mailrelay sync record failed", error);
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }
  return { batchItemFailures };
}
