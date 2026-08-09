import { createHash } from "crypto";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import type { MailrelaySyncQueueMessage } from "../../types/index.js";

const sqs = new SQSClient({});

export async function enqueueMailrelaySync(
  queueUrl: string,
  message: MailrelaySyncQueueMessage
): Promise<void> {
  if (!queueUrl) throw new Error("MAILRELAY_SYNC_QUEUE_URL is not configured");
  const fifo = queueUrl.endsWith(".fifo");
  const cursorKey = createHash("sha256")
    .update(message.cursor ?? "first")
    .digest("hex");
  await sqs.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(message),
      ...(fifo
        ? {
            MessageGroupId: message.tenantId,
            MessageDeduplicationId: `${message.jobId}:${cursorKey}`,
          }
        : {}),
    })
  );
}
