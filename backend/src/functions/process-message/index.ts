import type { SQSEvent, SQSRecord } from "aws-lambda";
import { processInboundMessage } from "../../lib/process-inbound/index.js";
import { parseInboundQueueBody } from "../../lib/process-inbound/parse.js";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";

export async function handler(event: SQSEvent): Promise<void> {
  for (const record of event.Records) {
    await processRecord(record);
  }
}

async function processRecord(record: SQSRecord): Promise<void> {
  const body = parseInboundQueueBody(record.body);
  if (!body) {
    console.error("Failed to parse SQS message body", record.body);
    return;
  }

  try {
    await processInboundMessage(body, ENVIRONMENT);
    console.log(
      `Processed ${body.channel} message tenant=${body.tenantId} bot=${body.botId} participant=${body.participantId}`
    );
  } catch (error) {
    console.error(
      `Failed to process message tenant=${body.tenantId} bot=${body.botId}:`,
      error
    );
    throw error;
  }
}
