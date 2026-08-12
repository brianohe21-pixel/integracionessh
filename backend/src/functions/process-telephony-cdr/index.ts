import type { SQSEvent } from "aws-lambda";
import { reconcileCallCost } from "../../lib/telephony/service.js";

interface CdrQueueMessage {
  tenantId: string;
  botId: string;
  callId: string;
  callControlId: string;
  attempt: number;
}

export async function handler(event: SQSEvent): Promise<void> {
  for (const record of event.Records) {
    const message = JSON.parse(record.body) as CdrQueueMessage;
    await reconcileCallCost(message);
  }
}
