import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import type { WhatsAppSyncQueueMessage } from "../../../types/index.js";

const sqs = new SQSClient({});

export async function enqueueWhatsAppSync(
  queueUrl: string,
  message: WhatsAppSyncQueueMessage
): Promise<void> {
  if (!queueUrl) throw new Error("WHATSAPP_SYNC_QUEUE_URL is not configured");

  const groupId =
    message.tenantId && message.botId
      ? `${message.tenantId}-${message.botId}`
      : message.phoneNumberId ?? "whatsapp-sync";

  const dedupeKey = message.dedupeKey ?? `${message.jobType}-${Date.now()}`;

  await sqs.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(message),
      MessageGroupId: groupId,
      MessageDeduplicationId: dedupeKey.slice(0, 128),
    })
  );
}
