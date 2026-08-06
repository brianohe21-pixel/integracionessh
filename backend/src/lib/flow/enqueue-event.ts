import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { randomUUID } from "crypto";
import type { FlowEventSubmission } from "../../types/index.js";

const sqs = new SQSClient({});
const QUEUE_URL = process.env.FLOW_EVENT_SQS_QUEUE_URL ?? "";

export async function enqueueFlowEventSubmission(
  submission: FlowEventSubmission
): Promise<void> {
  if (!QUEUE_URL) {
    throw new Error("FLOW_EVENT_SQS_QUEUE_URL is not configured");
  }

  await sqs.send(
    new SendMessageCommand({
      QueueUrl: QUEUE_URL,
      MessageBody: JSON.stringify({
        tenantId: submission.tenantId,
        submissionId: submission.submissionId,
        flowId: submission.flowId,
        hookKey: submission.hookKey,
      }),
      MessageGroupId: submission.flowId,
      MessageDeduplicationId: submission.submissionId,
    })
  );
}

export async function enqueueFlowEventSubmissionSafe(
  submission: FlowEventSubmission
): Promise<void> {
  try {
    await enqueueFlowEventSubmission(submission);
  } catch (err) {
    console.error("Failed to enqueue flow event submission", {
      submissionId: submission.submissionId,
      error: err,
    });
    throw err;
  }
}

export function makeSubmissionId(): string {
  return randomUUID();
}
