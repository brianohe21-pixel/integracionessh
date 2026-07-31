import {
  SchedulerClient,
  CreateScheduleCommand,
  DeleteScheduleCommand,
} from "@aws-sdk/client-scheduler";
import {
  campaignBatchScheduleName,
  campaignStartScheduleName,
  toSchedulerExpression,
} from "./batch.js";

const scheduler = new SchedulerClient({});

const SCHEDULER_ROLE_ARN = process.env.SCHEDULER_ROLE_ARN ?? "";
const CAMPAIGNS_FUNCTION_ARN = process.env.CAMPAIGNS_FUNCTION_ARN ?? "";

export async function createCampaignStartSchedule(
  campaignId: string,
  tenantId: string,
  scheduledAt: string
): Promise<void> {
  if (!SCHEDULER_ROLE_ARN || !CAMPAIGNS_FUNCTION_ARN) return;

  const scheduleTime = new Date(scheduledAt);
  await scheduler.send(
    new CreateScheduleCommand({
      Name: campaignStartScheduleName(campaignId),
      GroupName: "default",
      ScheduleExpression: toSchedulerExpression(scheduleTime),
      ScheduleExpressionTimezone: "UTC",
      FlexibleTimeWindow: { Mode: "OFF" },
      Target: {
        Arn: CAMPAIGNS_FUNCTION_ARN,
        RoleArn: SCHEDULER_ROLE_ARN,
        Input: JSON.stringify({
          action: "start-scheduled",
          campaignId,
          tenantId,
        }),
      },
      ActionAfterCompletion: "DELETE",
    })
  );
}

export async function deleteCampaignStartSchedule(campaignId: string): Promise<void> {
  if (!SCHEDULER_ROLE_ARN) return;
  try {
    await scheduler.send(
      new DeleteScheduleCommand({
        Name: campaignStartScheduleName(campaignId),
        GroupName: "default",
      })
    );
  } catch {
    // Schedule may not exist
  }
}

export async function createCampaignBatchSchedule(
  campaignId: string,
  tenantId: string,
  runAt: Date,
  batchVersion: number
): Promise<void> {
  if (!SCHEDULER_ROLE_ARN || !CAMPAIGNS_FUNCTION_ARN) return;

  await scheduler.send(
    new CreateScheduleCommand({
      Name: campaignBatchScheduleName(campaignId),
      GroupName: "default",
      ScheduleExpression: toSchedulerExpression(runAt),
      ScheduleExpressionTimezone: "UTC",
      FlexibleTimeWindow: { Mode: "OFF" },
      Target: {
        Arn: CAMPAIGNS_FUNCTION_ARN,
        RoleArn: SCHEDULER_ROLE_ARN,
        Input: JSON.stringify({
          action: "dispatch-batch",
          campaignId,
          tenantId,
          batchVersion,
        }),
      },
      ActionAfterCompletion: "DELETE",
    })
  );
}

export async function deleteCampaignBatchSchedule(campaignId: string): Promise<void> {
  if (!SCHEDULER_ROLE_ARN) return;
  try {
    await scheduler.send(
      new DeleteScheduleCommand({
        Name: campaignBatchScheduleName(campaignId),
        GroupName: "default",
      })
    );
  } catch {
    // Schedule may not exist
  }
}
