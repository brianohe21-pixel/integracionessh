import {
  SchedulerClient,
  CreateScheduleCommand,
  DeleteScheduleCommand,
} from "@aws-sdk/client-scheduler";
import type { MetricsReportSchedule } from "../../types/index.js";

const scheduler = new SchedulerClient({});
const SCHEDULER_ROLE_ARN = process.env.SCHEDULER_ROLE_ARN ?? "";
const REPORTS_FUNCTION_ARN = process.env.REPORTS_FUNCTION_ARN ?? "";

const DAY_NAMES: Record<number, string> = {
  1: "MON",
  2: "TUE",
  3: "WED",
  4: "THU",
  5: "FRI",
  6: "SAT",
  7: "SUN",
};

export function reportScheduleName(tenantId: string): string {
  return `metrics-report-${tenantId}`;
}

function dayOfWeekToCron(dayOfWeek: number): string {
  return DAY_NAMES[dayOfWeek] ?? "MON";
}

export function buildReportScheduleExpression(schedule: MetricsReportSchedule): string {
  const hour = Math.min(23, Math.max(0, schedule.hour));
  if (schedule.frequency === "weekly") {
    const dow = dayOfWeekToCron(schedule.dayOfWeek ?? 1);
    return `cron(0 ${hour} ? * ${dow} *)`;
  }
  return `cron(0 ${hour} * * ? *)`;
}

export async function syncReportSchedule(
  tenantId: string,
  schedule: MetricsReportSchedule
): Promise<void> {
  const name = reportScheduleName(tenantId);
  await deleteReportSchedule(tenantId);

  if (!schedule.enabled) return;
  if (!SCHEDULER_ROLE_ARN || !REPORTS_FUNCTION_ARN) {
    console.warn("Scheduler not configured; skipping metrics report schedule");
    return;
  }

  const timezone = schedule.timezone?.trim() || "UTC";

  await scheduler.send(
    new CreateScheduleCommand({
      Name: name,
      GroupName: "default",
      ScheduleExpression: buildReportScheduleExpression(schedule),
      ScheduleExpressionTimezone: timezone,
      FlexibleTimeWindow: { Mode: "OFF" },
      Target: {
        Arn: REPORTS_FUNCTION_ARN,
        RoleArn: SCHEDULER_ROLE_ARN,
        Input: JSON.stringify({ action: "send-scheduled-report", tenantId }),
      },
    })
  );
}

export async function deleteReportSchedule(tenantId: string): Promise<void> {
  if (!SCHEDULER_ROLE_ARN) return;
  try {
    await scheduler.send(
      new DeleteScheduleCommand({
        Name: reportScheduleName(tenantId),
        GroupName: "default",
      })
    );
  } catch {
    // may not exist
  }
}
