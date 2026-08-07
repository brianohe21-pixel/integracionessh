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
    const result = await reconcileCallCost(message);
    if (!result.done && message.attempt < 5) {
      await new Promise((resolve) => setTimeout(resolve, message.attempt * 2000));
    }
  }
}
