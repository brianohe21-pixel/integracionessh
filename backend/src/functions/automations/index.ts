import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import {
  SchedulerClient,
  CreateScheduleCommand,
  DeleteScheduleCommand,
} from "@aws-sdk/client-scheduler";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { randomUUID } from "crypto";
import { z } from "zod";
import { extractAuthContext, assertMemberRole } from "../../lib/auth/cognito.js";
import { getBot } from "../../lib/dynamodb/bot.repository.js";
import { getTenant } from "../../lib/dynamodb/tenant.repository.js";
import {
  assertCanCreateAutomation,
  assertCanEnableScheduledAutomation,
} from "../../lib/billing/assert-plan.js";
import {
  createAutomation,
  deleteAutomation,
  getAutomation,
  listAutomations,
  makeAutomationId,
  updateAutomation,
} from "../../lib/dynamodb/automation.repository.js";
import { ok, created, badRequest, notFound, noContent, handleError } from "../../lib/http.js";
import type { AutomationAction, AutomationTrigger } from "../../types/index.js";

const scheduler = new SchedulerClient({});
const sqs = new SQSClient({});

const SCHEDULER_ROLE_ARN = process.env.SCHEDULER_ROLE_ARN ?? "";
const AUTOMATIONS_FUNCTION_ARN = process.env.AUTOMATIONS_FUNCTION_ARN ?? "";
const AUTOMATION_QUEUE_URL = process.env.AUTOMATION_SQS_QUEUE_URL ?? "";

const RuleSchema = z.object({
  name: z.string().min(1).max(120),
  botId: z.string().uuid(),
  enabled: z.boolean().default(true),
  priority: z.number().int().min(0).max(9999).default(100),
  trigger: z.enum(["keyword", "first_message", "schedule"]),
  keywords: z.array(z.string().max(100)).max(20).optional(),
  matchMode: z.enum(["contains", "exact"]).optional(),
  scheduledAt: z.string().datetime().optional(),
  targetPhones: z.array(z.string().min(10)).max(5000).optional(),
  targetTags: z.array(z.string().max(50)).max(20).optional(),
  action: z.enum(["send_text", "send_template", "tag_contact", "handoff"]),
  messageText: z.string().max(4096).optional(),
  templateName: z.string().max(128).optional(),
  templateLanguage: z.string().max(10).optional(),
  templateVariables: z.record(z.string()).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  stopProcessing: z.boolean().optional(),
});

async function createSchedule(ruleId: string, tenantId: string, scheduledAt: string): Promise<void> {
  if (!SCHEDULER_ROLE_ARN || !AUTOMATIONS_FUNCTION_ARN) return;
  const scheduleTime = new Date(scheduledAt);
  await scheduler.send(
    new CreateScheduleCommand({
      Name: `automation-${ruleId}`,
      GroupName: "default",
      ScheduleExpression: `at(${scheduleTime.toISOString().slice(0, 19)})`,
      ScheduleExpressionTimezone: "UTC",
      FlexibleTimeWindow: { Mode: "OFF" },
      Target: {
        Arn: AUTOMATIONS_FUNCTION_ARN,
        RoleArn: SCHEDULER_ROLE_ARN,
        Input: JSON.stringify({ action: "run-scheduled-rule", ruleId, tenantId }),
      },
      ActionAfterCompletion: "DELETE",
    })
  );
}

async function deleteSchedule(ruleId: string): Promise<void> {
  if (!SCHEDULER_ROLE_ARN) return;
  try {
    await scheduler.send(
      new DeleteScheduleCommand({ Name: `automation-${ruleId}`, GroupName: "default" })
    );
  } catch {
    // may not exist
  }
}

async function enqueueScheduledRule(tenantId: string, ruleId: string): Promise<void> {
  if (!AUTOMATION_QUEUE_URL) return;
  await sqs.send(
    new SendMessageCommand({
      QueueUrl: AUTOMATION_QUEUE_URL,
      MessageBody: JSON.stringify({ tenantId, ruleId }),
      MessageGroupId: ruleId,
      MessageDeduplicationId: `${ruleId}-${Date.now()}-${randomUUID()}`,
    })
  );
}

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer | Record<string, unknown>
): Promise<APIGatewayProxyResultV2> {
  try {
    if ("action" in event && event.action === "run-scheduled-rule") {
      const { ruleId, tenantId } = event as { ruleId: string; tenantId: string };
      await enqueueScheduledRule(tenantId, ruleId);
      return ok({ message: "Scheduled automation enqueued" });
    }

    const apiEvent = event as APIGatewayProxyEventV2WithJWTAuthorizer;
    const auth = extractAuthContext(apiEvent);
    assertMemberRole(auth);

    const method = apiEvent.requestContext.http.method;
    const ruleId = apiEvent.pathParameters?.ruleId;
    const rawPath = apiEvent.rawPath ?? "";
    const subAction = rawPath.split("/").pop();

    if (method === "GET" && !ruleId) {
      const botId = apiEvent.queryStringParameters?.botId;
      const rules = await listAutomations(auth.tenantId, botId);
      return ok({ rules });
    }

    if (method === "GET" && ruleId) {
      const rule = await getAutomation(auth.tenantId, ruleId);
      if (!rule) return notFound("Automation not found");
      return ok(rule);
    }

    if (method === "POST" && !ruleId) {
      const body = RuleSchema.parse(JSON.parse(apiEvent.body ?? "{}"));
      const bot = await getBot(auth.tenantId, body.botId);
      if (!bot) return badRequest("Bot not found");

      const tenant = await getTenant(auth.tenantId);
      if (tenant) await assertCanCreateAutomation(tenant, body.botId);

      const ruleIdNew = makeAutomationId();
      const rule = await createAutomation({
        ruleId: ruleIdNew,
        tenantId: auth.tenantId,
        name: body.name,
        botId: body.botId,
        enabled: body.enabled,
        priority: body.priority,
        trigger: body.trigger as AutomationTrigger,
        action: body.action as AutomationAction,
        ...(body.keywords !== undefined ? { keywords: body.keywords } : {}),
        ...(body.matchMode !== undefined ? { matchMode: body.matchMode } : {}),
        ...(body.scheduledAt !== undefined ? { scheduledAt: body.scheduledAt } : {}),
        ...(body.targetPhones !== undefined ? { targetPhones: body.targetPhones } : {}),
        ...(body.targetTags !== undefined ? { targetTags: body.targetTags } : {}),
        ...(body.messageText !== undefined ? { messageText: body.messageText } : {}),
        ...(body.templateName !== undefined ? { templateName: body.templateName } : {}),
        ...(body.templateLanguage !== undefined ? { templateLanguage: body.templateLanguage } : {}),
        ...(body.templateVariables !== undefined ? { templateVariables: body.templateVariables } : {}),
        ...(body.tags !== undefined ? { tags: body.tags } : {}),
        ...(body.stopProcessing !== undefined ? { stopProcessing: body.stopProcessing } : {}),
      });

      if (rule.trigger === "schedule" && rule.scheduledAt && rule.enabled) {
        if (tenant) await assertCanEnableScheduledAutomation(tenant);
        await createSchedule(ruleIdNew, auth.tenantId, rule.scheduledAt);
      }

      return created(rule);
    }

    if (method === "PUT" && ruleId) {
      const existing = await getAutomation(auth.tenantId, ruleId);
      if (!existing) return notFound("Automation not found");

      const body = RuleSchema.partial().parse(JSON.parse(apiEvent.body ?? "{}"));
      const tenant = await getTenant(auth.tenantId);

      if (body.enabled === true && (body.trigger === "schedule" || existing.trigger === "schedule")) {
        if (tenant) await assertCanEnableScheduledAutomation(tenant);
      }

      const updates: Parameters<typeof updateAutomation>[2] = {};
      if (body.name !== undefined) updates.name = body.name;
      if (body.botId !== undefined) updates.botId = body.botId;
      if (body.enabled !== undefined) updates.enabled = body.enabled;
      if (body.priority !== undefined) updates.priority = body.priority;
      if (body.trigger !== undefined) updates.trigger = body.trigger;
      if (body.action !== undefined) updates.action = body.action;
      if (body.keywords !== undefined) updates.keywords = body.keywords;
      if (body.matchMode !== undefined) updates.matchMode = body.matchMode;
      if (body.scheduledAt !== undefined) updates.scheduledAt = body.scheduledAt;
      if (body.targetPhones !== undefined) updates.targetPhones = body.targetPhones;
      if (body.targetTags !== undefined) updates.targetTags = body.targetTags;
      if (body.messageText !== undefined) updates.messageText = body.messageText;
      if (body.templateName !== undefined) updates.templateName = body.templateName;
      if (body.templateLanguage !== undefined) updates.templateLanguage = body.templateLanguage;
      if (body.templateVariables !== undefined) updates.templateVariables = body.templateVariables;
      if (body.tags !== undefined) updates.tags = body.tags;
      if (body.stopProcessing !== undefined) updates.stopProcessing = body.stopProcessing;

      const updated = await updateAutomation(auth.tenantId, ruleId, updates);
      if (!updated) return notFound("Automation not found");

      if (updated.trigger === "schedule") {
        await deleteSchedule(ruleId);
        if (updated.enabled && updated.scheduledAt) {
          await createSchedule(ruleId, auth.tenantId, updated.scheduledAt);
        }
      }

      return ok(updated);
    }

    if (method === "DELETE" && ruleId) {
      await deleteSchedule(ruleId);
      const deleted = await deleteAutomation(auth.tenantId, ruleId);
      if (!deleted) return notFound("Automation not found");
      return noContent();
    }

    if (method === "POST" && ruleId && subAction === "enable") {
      const tenant = await getTenant(auth.tenantId);
      const existing = await getAutomation(auth.tenantId, ruleId);
      if (!existing) return notFound("Automation not found");
      if (existing.trigger === "schedule" && tenant) {
        await assertCanEnableScheduledAutomation(tenant);
      }
      const updated = await updateAutomation(auth.tenantId, ruleId, { enabled: true });
      if (updated?.trigger === "schedule" && updated.scheduledAt) {
        await createSchedule(ruleId, auth.tenantId, updated.scheduledAt);
      }
      return ok(updated);
    }

    if (method === "POST" && ruleId && subAction === "disable") {
      await deleteSchedule(ruleId);
      const updated = await updateAutomation(auth.tenantId, ruleId, { enabled: false });
      if (!updated) return notFound("Automation not found");
      return ok(updated);
    }

    return badRequest("Route not found");
  } catch (error) {
    return handleError(error);
  }
}
