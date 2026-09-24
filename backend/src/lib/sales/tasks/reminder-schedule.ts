import {
  SchedulerClient,
  CreateScheduleCommand,
  DeleteScheduleCommand,
} from "@aws-sdk/client-scheduler";
import { updateSalesTask } from "../../dynamodb/sales-task.repository.js";
import type { SalesTask } from "../../../types/index.js";

const scheduler = new SchedulerClient({});
const SCHEDULER_ROLE_ARN = process.env.SCHEDULER_ROLE_ARN ?? "";
const SALES_FUNCTION_ARN = process.env.SALES_FUNCTION_ARN ?? "";

export function taskReminderScheduleName(taskId: string): string {
  return `task-reminder-${taskId}`;
}

export function computeTaskReminderAt(dueAt: string, minutesBefore: number): Date {
  return new Date(new Date(dueAt).getTime() - minutesBefore * 60 * 1000);
}

export function shouldScheduleTaskReminder(task: SalesTask): boolean {
  if (task.status !== "open") return false;
  if (!task.dueAt) return false;
  if (!task.reminderChannels?.length) return false;
  const channels = new Set(task.reminderChannels);
  if (channels.has("platform")) return true;
  if (!task.reminderTargets?.length) return false;
  return channels.has("email") || channels.has("whatsapp");
}

export async function cancelTaskReminder(task: SalesTask): Promise<SalesTask> {
  if (task.reminderScheduleName) {
    try {
      await scheduler.send(
        new DeleteScheduleCommand({
          Name: task.reminderScheduleName,
          GroupName: "default",
        })
      );
    } catch {
      // schedule may already have fired or been deleted
    }
  }

  if (
    task.reminderStatus === "scheduled" ||
    task.reminderScheduleName ||
    task.reminderStatus === undefined
  ) {
    const updated = await updateSalesTask(task.tenantId, task.taskId, {
      reminderStatus: "cancelled",
      reminderScheduleName: null,
    });
    return updated ?? task;
  }

  return task;
}

export async function scheduleTaskReminder(task: SalesTask): Promise<SalesTask> {
  if (!shouldScheduleTaskReminder(task)) {
    if (task.reminderScheduleName || task.reminderStatus === "scheduled") {
      return cancelTaskReminder(task);
    }
    return task;
  }

  const minutesBefore = task.reminderMinutesBefore ?? 60;
  const reminderAt = computeTaskReminderAt(task.dueAt!, minutesBefore);
  const now = new Date();

  if (reminderAt <= now) {
    const { sendTaskReminder } = await import("./reminder-send.js");
    await sendTaskReminder({ tenantId: task.tenantId, taskId: task.taskId });
    const { getSalesTaskById } = await import("../../dynamodb/sales-task.repository.js");
    const fresh = await getSalesTaskById(task.tenantId, task.taskId);
    return fresh ?? task;
  }

  if (!SCHEDULER_ROLE_ARN || !SALES_FUNCTION_ARN) {
    console.warn("Scheduler not configured; skipping task reminder");
    const skipped = await updateSalesTask(task.tenantId, task.taskId, {
      reminderStatus: "skipped",
      reminderScheduleName: null,
    });
    return skipped ?? task;
  }

  if (task.reminderScheduleName) {
    try {
      await scheduler.send(
        new DeleteScheduleCommand({
          Name: task.reminderScheduleName,
          GroupName: "default",
        })
      );
    } catch {
      // ignore missing schedule
    }
  }

  const scheduleName = taskReminderScheduleName(task.taskId);
  const scheduleExpression = `at(${reminderAt.toISOString().slice(0, 19)})`;

  await scheduler.send(
    new CreateScheduleCommand({
      Name: scheduleName,
      GroupName: "default",
      ScheduleExpression: scheduleExpression,
      ScheduleExpressionTimezone: "UTC",
      FlexibleTimeWindow: { Mode: "OFF" },
      Target: {
        Arn: SALES_FUNCTION_ARN,
        RoleArn: SCHEDULER_ROLE_ARN,
        Input: JSON.stringify({
          action: "send-task-reminder",
          tenantId: task.tenantId,
          taskId: task.taskId,
        }),
      },
      ActionAfterCompletion: "DELETE",
    })
  );

  const updated = await updateSalesTask(task.tenantId, task.taskId, {
    reminderScheduleName: scheduleName,
    reminderStatus: "scheduled",
  });
  return updated ?? task;
}

export async function syncTaskReminder(task: SalesTask): Promise<SalesTask> {
  if (task.status !== "open" || task.reminderSentAt) {
    if (task.reminderScheduleName) {
      return cancelTaskReminder(task);
    }
    return task;
  }
  return scheduleTaskReminder(task);
}
