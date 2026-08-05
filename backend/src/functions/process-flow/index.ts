import type { SQSEvent } from "aws-lambda";
import { resumeFlowRunById } from "../../lib/flow/interpreter.js";
import { resumeEventFlowRun } from "../../lib/flow/event-runner.js";
import { getFlowRun } from "../../lib/dynamodb/flow.repository.js";

export async function handler(event: SQSEvent): Promise<void> {
  for (const record of event.Records) {
    try {
      const body = JSON.parse(record.body) as {
        tenantId: string;
        runId: string;
        action?: string;
      };
      if (body.action === "resume" || !body.action) {
        const run = await getFlowRun(body.tenantId, body.runId);
        if (run?.source === "event") {
          await resumeEventFlowRun(body.tenantId, body.runId);
        } else {
          await resumeFlowRunById(body.tenantId, body.runId);
        }
      }
    } catch (err) {
      console.error("Failed to process flow run message:", err);
    }
  }
}
