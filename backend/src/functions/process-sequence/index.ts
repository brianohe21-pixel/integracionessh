import type { SQSEvent, SQSRecord } from "aws-lambda";
import { processSequenceStep } from "../../lib/sales/sequences/executor.js";

export async function handler(event: SQSEvent): Promise<void> {
  for (const record of event.Records) {
    await processRecord(record);
  }
}

async function processRecord(record: SQSRecord): Promise<void> {
  let body: { tenantId: string; enrollmentId: string; stepIndex: number };
  try {
    body = JSON.parse(record.body) as { tenantId: string; enrollmentId: string; stepIndex: number };
  } catch {
    console.error("Invalid sequence queue message", record.body);
    return;
  }

  await processSequenceStep(body.tenantId, body.enrollmentId, body.stepIndex);
}
