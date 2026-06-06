import { SchedulerClient, CreateScheduleCommand } from "@aws-sdk/client-scheduler";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { randomUUID } from "crypto";

const scheduler = new SchedulerClient({});
const sqs = new SQSClient({});

const SCHEDULER_ROLE_ARN = process.env.SCHEDULER_ROLE_ARN ?? "";
const FLOWS_FUNCTION_ARN = process.env.FLOWS_FUNCTION_ARN ?? "";
const FLOW_RUN_QUEUE_URL = process.env.FLOW_RUN_SQS_QUEUE_URL ?? "";

export async function scheduleFlowResume(
  runId: string,
  tenantId: string,
  resumeAt: string
): Promise<void> {
  if (SCHEDULER_ROLE_ARN && FLOWS_FUNCTION_ARN) {
    const scheduleTime = new Date(resumeAt);
    await scheduler.send(
      new CreateScheduleCommand({
        Name: `flow-run-${runId.slice(0, 8)}-${Date.now()}`,
        GroupName: "default",
        ScheduleExpression: `at(${scheduleTime.toISOString().slice(0, 19)})`,
        ScheduleExpressionTimezone: "UTC",
        FlexibleTimeWindow: { Mode: "OFF" },
        Target: {
          Arn: FLOWS_FUNCTION_ARN,
          RoleArn: SCHEDULER_ROLE_ARN,
          Input: JSON.stringify({ action: "resume-flow-run", runId, tenantId }),
        },
        ActionAfterCompletion: "DELETE",
      })
    );
    return;
  }

  if (FLOW_RUN_QUEUE_URL) {
    await sqs.send(
      new SendMessageCommand({
        QueueUrl: FLOW_RUN_QUEUE_URL,
        MessageBody: JSON.stringify({ tenantId, runId, action: "resume" }),
        MessageGroupId: runId,
        MessageDeduplicationId: `${runId}-resume-${randomUUID()}`,
        DelaySeconds: Math.min(
          900,
          Math.max(0, Math.floor((new Date(resumeAt).getTime() - Date.now()) / 1000))
        ),
      })
    );
  }
}
