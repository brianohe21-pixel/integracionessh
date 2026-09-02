import {
  SchedulerClient,
  CreateScheduleCommand,
  DeleteScheduleCommand,
} from "@aws-sdk/client-scheduler";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import type { SequenceEnrollment } from "../../../types/index.js";

const scheduler = new SchedulerClient({});
const sqs = new SQSClient({});

const SCHEDULER_ROLE_ARN = process.env.SCHEDULER_ROLE_ARN ?? "";
const SALES_FUNCTION_ARN = process.env.SALES_FUNCTION_ARN ?? "";
const SEQUENCE_SQS_QUEUE_URL = process.env.SEQUENCE_SQS_QUEUE_URL ?? "";

export function sequenceStepScheduleName(enrollmentId: string, stepIndex: number): string {
  return `seq-step-${enrollmentId}-${stepIndex}`;
}

export function computeNextRunAt(delayMinutes: number, from = new Date()): string {
  return new Date(from.getTime() + delayMinutes * 60 * 1000).toISOString();
}

export async function cancelEnrollmentSchedule(scheduleName?: string): Promise<void> {
  if (!scheduleName || !SCHEDULER_ROLE_ARN) return;
  try {
    await scheduler.send(
      new DeleteScheduleCommand({
        Name: scheduleName,
        GroupName: "default",
      })
    );
  } catch {
    // schedule may already have fired
  }
}

export async function scheduleEnrollmentStep(
  enrollment: SequenceEnrollment,
  stepIndex: number,
  runAt: string
): Promise<string | undefined> {
  const scheduleName = sequenceStepScheduleName(enrollment.enrollmentId, stepIndex);
  const runDate = new Date(runAt);
  const now = new Date();

  if (runDate <= now) {
    await enqueueSequenceStep(enrollment.tenantId, enrollment.enrollmentId, stepIndex);
    return undefined;
  }

  if (!SCHEDULER_ROLE_ARN || !SALES_FUNCTION_ARN) {
    await enqueueSequenceStep(enrollment.tenantId, enrollment.enrollmentId, stepIndex);
    return undefined;
  }

  await scheduler.send(
    new CreateScheduleCommand({
      Name: scheduleName,
      GroupName: "default",
      ScheduleExpression: `at(${runDate.toISOString().slice(0, 19)})`,
      ScheduleExpressionTimezone: "UTC",
      FlexibleTimeWindow: { Mode: "OFF" },
      Target: {
        Arn: SALES_FUNCTION_ARN,
        RoleArn: SCHEDULER_ROLE_ARN,
        Input: JSON.stringify({
          action: "run-sequence-step",
          tenantId: enrollment.tenantId,
          enrollmentId: enrollment.enrollmentId,
          stepIndex,
        }),
      },
      ActionAfterCompletion: "DELETE",
    })
  );

  return scheduleName;
}

export async function enqueueSequenceStep(
  tenantId: string,
  enrollmentId: string,
  stepIndex: number
): Promise<void> {
  if (!SEQUENCE_SQS_QUEUE_URL) return;
  await sqs.send(
    new SendMessageCommand({
      QueueUrl: SEQUENCE_SQS_QUEUE_URL,
      MessageBody: JSON.stringify({ tenantId, enrollmentId, stepIndex }),
      MessageGroupId: enrollmentId,
      MessageDeduplicationId: `${enrollmentId}-${stepIndex}`,
    })
  );
}
