import type { SQSEvent } from "aws-lambda";
import { startEventFlowRun } from "../../lib/flow/event-runner.js";
import {
  getFlowEventSubmission,
  updateFlowEventSubmission,
} from "../../lib/dynamodb/flow-event.repository.js";

export async function handler(event: SQSEvent): Promise<void> {
  for (const record of event.Records) {
    try {
      const body = JSON.parse(record.body) as {
        tenantId: string;
        submissionId: string;
        flowId: string;
      };

      const submission = await getFlowEventSubmission(body.tenantId, body.submissionId);
      if (!submission) continue;
      if (submission.status === "completed" || submission.status === "failed") continue;

      await updateFlowEventSubmission(body.tenantId, body.submissionId, {
        status: "processing",
      });

      await startEventFlowRun({
        tenantId: body.tenantId,
        flowId: body.flowId,
        submissionId: body.submissionId,
        payload: submission.payload,
      });
    } catch (err) {
      console.error("Failed to process flow event message:", err);
      const body = JSON.parse(record.body) as {
        tenantId: string;
        submissionId: string;
      };
      await updateFlowEventSubmission(body.tenantId, body.submissionId, {
        status: "failed",
        errorMessage: err instanceof Error ? err.message : "Processing failed",
      }).catch(() => undefined);
      throw err;
    }
  }
}
