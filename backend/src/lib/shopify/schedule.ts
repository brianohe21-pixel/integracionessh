import {
  SchedulerClient,
  CreateScheduleCommand,
  DeleteScheduleCommand,
} from "@aws-sdk/client-scheduler";
import { createHash } from "crypto";

const scheduler = new SchedulerClient({});

const SCHEDULER_ROLE_ARN = process.env.SCHEDULER_ROLE_ARN ?? "";
const PROCESS_SHOPIFY_FUNCTION_ARN = process.env.PROCESS_SHOPIFY_FUNCTION_ARN ?? "";

function scheduleNameForCheckout(tenantId: string, checkoutToken: string): string {
  const hash = createHash("sha256")
    .update(`${tenantId}:${checkoutToken}`)
    .digest("hex")
    .slice(0, 24);
  return `shopify-co-${hash}`;
}

export async function cancelAbandonedCheckoutSchedule(
  scheduleName: string | undefined
): Promise<void> {
  if (!scheduleName || !SCHEDULER_ROLE_ARN) return;
  try {
    await scheduler.send(
      new DeleteScheduleCommand({
        Name: scheduleName,
        GroupName: "default",
      })
    );
  } catch {
    // schedule may already be gone
  }
}

export async function scheduleAbandonedCheckout(params: {
  tenantId: string;
  checkoutToken: string;
  notifyAt: Date;
  previousScheduleName?: string;
}): Promise<string | undefined> {
  if (!SCHEDULER_ROLE_ARN || !PROCESS_SHOPIFY_FUNCTION_ARN) {
    console.warn("Shopify abandoned checkout scheduler is not configured");
    return undefined;
  }

  if (params.previousScheduleName) {
    await cancelAbandonedCheckoutSchedule(params.previousScheduleName);
  }

  const name = scheduleNameForCheckout(params.tenantId, params.checkoutToken);
  await cancelAbandonedCheckoutSchedule(name);

  await scheduler.send(
    new CreateScheduleCommand({
      Name: name,
      GroupName: "default",
      ScheduleExpression: `at(${params.notifyAt.toISOString().slice(0, 19)})`,
      ScheduleExpressionTimezone: "UTC",
      FlexibleTimeWindow: { Mode: "OFF" },
      Target: {
        Arn: PROCESS_SHOPIFY_FUNCTION_ARN,
        RoleArn: SCHEDULER_ROLE_ARN,
        Input: JSON.stringify({
          action: "abandoned-checkout",
          tenantId: params.tenantId,
          checkoutToken: params.checkoutToken,
        }),
      },
      ActionAfterCompletion: "DELETE",
    })
  );

  return name;
}
