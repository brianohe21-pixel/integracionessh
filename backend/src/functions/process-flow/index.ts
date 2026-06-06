import type { SQSEvent } from "aws-lambda";
import { resumeFlowRunById } from "../../lib/flow/interpreter.js";

export async function handler(event: SQSEvent): Promise<void> {
  for (const record of event.Records) {
    try {
      const body = JSON.parse(record.body) as {
        tenantId: string;
        runId: string;
        action?: string;
      };
      if (body.action === "resume" || !body.action) {
        await resumeFlowRunById(body.tenantId, body.runId);
      }
    } catch (err) {
      console.error("Failed to process flow run message:", err);
    }
  }
}
