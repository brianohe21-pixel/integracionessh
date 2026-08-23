import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { randomUUID } from "crypto";
import { z } from "zod";
import {
  resolveRequestAuth,
  assertMemberRole,
  assertTenantManagerRole,
} from "../../lib/auth/cognito.js";
import { assertAssignedServices } from "../../lib/billing/subaccount-services.js";
import {
  ok,
  created,
  badRequest,
  notFound,
  noContent,
  handleError,
} from "../../lib/http.js";
import { ensureDefaultPipeline } from "../../lib/sales/pipeline-bootstrap.js";
import {
  createPipeline,
  deletePipeline,
  getPipelineById,
  listPipelines,
  updatePipeline,
} from "../../lib/dynamodb/pipeline.repository.js";
import {
  createOpportunity,
  deleteOpportunity,
  getOpportunityById,
  listOpportunities,
  listStageHistory,
  updateOpportunity,
} from "../../lib/dynamodb/opportunity.repository.js";
import {
  createSequence,
  deleteSequence,
  getSequenceById,
  listSequences,
  updateSequence,
} from "../../lib/dynamodb/sequence.repository.js";
import {
  listActiveEnrollmentsByOpportunity,
  listEnrollmentsByOpportunity,
} from "../../lib/dynamodb/sequence-enrollment.repository.js";
import {
  createSalesTask,
  getSalesTaskById,
  listSalesTasks,
  updateSalesTask,
} from "../../lib/dynamodb/sales-task.repository.js";
import { getSalesFunnelMetrics } from "../../lib/dynamodb/sales-funnel-metrics.repository.js";
import { moveOpportunityStage } from "../../lib/sales/opportunities/stage.js";
import {
  cancelEnrollment,
  enrollOpportunityInSequence,
  pauseEnrollment,
  resumeEnrollment,
} from "../../lib/sales/sequences/enroll.js";
import { processSequenceStep } from "../../lib/sales/sequences/executor.js";
import { findStageById } from "../../lib/dynamodb/pipeline.repository.js";
import { buildDefaultPipeline, findStageByKey } from "../../lib/sales/default-pipeline.js";
import { normalizePhone } from "../../lib/dynamodb/contact.repository.js";
import type {
  Opportunity,
  OpportunityStage,
  PipelineStage,
  SalesPipeline,
  SalesSequence,
  SalesSequenceStep,
  SalesTask,
} from "../../types/index.js";

const PipelineStageSchema = z.object({
  stageId: z.string().uuid().optional(),
  key: z.string().min(1).max(50),
  label: z.string().min(1).max(120),
  sortOrder: z.number().int().min(0),
  probability: z.number().min(0).max(100).optional(),
  isClosed: z.boolean().optional(),
  outcome: z.enum(["won", "lost"]).optional(),
});

const CreatePipelineSchema = z.object({
  name: z.string().min(1).max(120),
  stages: z.array(PipelineStageSchema).min(2).max(20).optional(),
});

const UpdatePipelineSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  stages: z.array(PipelineStageSchema).min(2).max(20).optional(),
});

const CreateOpportunitySchema = z.object({
  pipelineId: z.string().uuid().optional(),
  stageId: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  amount: z.number().min(0).optional(),
  currency: z.string().min(3).max(3).optional(),
  phone: z.string().max(32).optional(),
  name: z.string().max(128).optional(),
  email: z.string().email().max(256).optional(),
  description: z.string().max(2000).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  leadId: z.string().uuid().optional(),
  conversationId: z.string().uuid().optional(),
  botId: z.string().uuid().optional(),
  assignedAdvisorId: z.string().uuid().optional(),
});

const UpdateOpportunitySchema = CreateOpportunitySchema.partial().extend({
  quotationId: z.string().uuid().optional(),
  paymentId: z.string().uuid().optional(),
});

const MoveStageSchema = z.object({
  stageId: z.string().uuid(),
  closeReason: z.string().max(500).optional(),
});

const SequenceStepSchema = z.object({
  stepId: z.string().uuid().optional(),
  order: z.number().int().min(0),
  delayMinutes: z.number().int().min(0).max(60 * 24 * 30),
  channel: z.enum(["whatsapp", "email", "task"]),
  messageText: z.string().max(4096).optional(),
  templateName: z.string().max(128).optional(),
  templateLanguage: z.string().max(10).optional(),
  emailSubject: z.string().max(200).optional(),
  taskTitle: z.string().max(200).optional(),
  taskDescription: z.string().max(2000).optional(),
  taskDueMinutes: z.number().int().min(0).max(60 * 24 * 30).optional(),
  assignToAdvisor: z.boolean().optional(),
});

const CreateSequenceSchema = z.object({
  name: z.string().min(1).max(120),
  enabled: z.boolean().optional(),
  trigger: z.enum(["manual", "stage_entered", "opportunity_created"]).optional(),
  triggerStageId: z.string().uuid().optional(),
  pipelineId: z.string().uuid().optional(),
  steps: z.array(SequenceStepSchema).min(1).max(20),
});

const UpdateSequenceSchema = CreateSequenceSchema.partial();

const EnrollSchema = z.object({
  botId: z.string().uuid().optional(),
  assignedAdvisorId: z.string().uuid().optional(),
});

const CreateTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  opportunityId: z.string().uuid().optional(),
  advisorId: z.string().uuid().optional(),
  dueAt: z.string().datetime().optional(),
});

const UpdateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(["open", "done", "cancelled"]).optional(),
  advisorId: z.string().uuid().optional(),
  dueAt: z.string().datetime().optional(),
});

function parseSalesPath(rawPath: string): string[] {
  const normalized = rawPath.replace(/\/+$/, "");
  const idx = normalized.indexOf("/sales/");
  const suffix = idx >= 0 ? normalized.slice(idx + "/sales/".length) : normalized.replace(/^\/sales\/?/, "");
  return suffix.split("/").filter(Boolean);
}

function withStageIds(stages: z.infer<typeof PipelineStageSchema>[]): PipelineStage[] {
  return stages.map((stage) => ({
    stageId: stage.stageId ?? randomUUID(),
    key: stage.key,
    label: stage.label,
    sortOrder: stage.sortOrder,
    ...(stage.probability !== undefined ? { probability: stage.probability } : {}),
    ...(stage.isClosed ? { isClosed: true } : {}),
    ...(stage.outcome ? { outcome: stage.outcome } : {}),
  }));
}

function withStepIds(steps: z.infer<typeof SequenceStepSchema>[]): SalesSequenceStep[] {
  return steps.map((step) => ({
    stepId: step.stepId ?? randomUUID(),
    order: step.order,
    delayMinutes: step.delayMinutes,
    channel: step.channel,
    ...(step.messageText ? { messageText: step.messageText } : {}),
    ...(step.templateName ? { templateName: step.templateName } : {}),
    ...(step.templateLanguage ? { templateLanguage: step.templateLanguage } : {}),
    ...(step.emailSubject ? { emailSubject: step.emailSubject } : {}),
    ...(step.taskTitle ? { taskTitle: step.taskTitle } : {}),
    ...(step.taskDescription ? { taskDescription: step.taskDescription } : {}),
    ...(step.taskDueMinutes !== undefined ? { taskDueMinutes: step.taskDueMinutes } : {}),
    ...(step.assignToAdvisor !== undefined ? { assignToAdvisor: step.assignToAdvisor } : {}),
  }));
}

async function buildOpportunity(
  tenantId: string,
  data: z.infer<typeof CreateOpportunitySchema>
): Promise<Opportunity | null> {
  const pipeline = data.pipelineId
    ? await getPipelineById(tenantId, data.pipelineId)
    : await ensureDefaultPipeline(tenantId);
  if (!pipeline) return null;

  const stage = data.stageId
    ? findStageById(pipeline, data.stageId)
    : findStageByKey(pipeline, "new") ?? pipeline.stages[0];
  if (!stage) return null;

  const now = new Date().toISOString();
  return {
    opportunityId: randomUUID(),
    tenantId,
    pipelineId: pipeline.pipelineId,
    stageId: stage.stageId,
    stage: stage.key as OpportunityStage,
    title: data.title.trim(),
    currency: data.currency?.toUpperCase() ?? "USD",
    tags: data.tags ?? [],
    createdAt: now,
    updatedAt: now,
    ...(data.amount !== undefined ? { amount: data.amount } : {}),
    ...(data.phone ? { phone: normalizePhone(data.phone) } : {}),
    ...(data.name ? { name: data.name } : {}),
    ...(data.email ? { email: data.email } : {}),
    ...(data.description ? { description: data.description } : {}),
    ...(data.leadId ? { leadId: data.leadId } : {}),
    ...(data.conversationId ? { conversationId: data.conversationId } : {}),
    ...(data.botId ? { botId: data.botId } : {}),
    ...(data.assignedAdvisorId ? { assignedAdvisorId: data.assignedAdvisorId } : {}),
  };
}

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer | { action?: string; tenantId?: string; enrollmentId?: string; stepIndex?: number }
): Promise<APIGatewayProxyResultV2 | void> {
  try {
    if ("action" in event && event.action === "run-sequence-step") {
      if (!event.tenantId || !event.enrollmentId || event.stepIndex === undefined) return;
      await processSequenceStep(event.tenantId, event.enrollmentId, event.stepIndex);
      return;
    }

    const apiEvent = event as APIGatewayProxyEventV2WithJWTAuthorizer;
    const auth = await resolveRequestAuth(apiEvent);
    assertMemberRole(auth);
    await assertAssignedServices(auth.tenantId, "sales");

    const method = apiEvent.requestContext.http.method;
    const rawPath = apiEvent.rawPath ?? apiEvent.requestContext.http.path;
    const segments = parseSalesPath(rawPath);
    const params = apiEvent.queryStringParameters ?? {};

    if (method === "GET" && segments.length === 1 && segments[0] === "metrics") {
      const pipelineId = params.pipelineId ?? (await ensureDefaultPipeline(auth.tenantId)).pipelineId;
      const metrics = await getSalesFunnelMetrics(auth.tenantId, pipelineId);
      if (!metrics) return notFound("Pipeline not found");
      return ok(metrics);
    }

    if (method === "GET" && segments[0] === "pipelines" && segments.length === 1) {
      await ensureDefaultPipeline(auth.tenantId);
      const pipelines = await listPipelines(auth.tenantId);
      return ok({ items: pipelines });
    }

    if (method === "POST" && segments[0] === "pipelines" && segments.length === 1) {
      assertTenantManagerRole(auth);
      const parsed = CreatePipelineSchema.safeParse(JSON.parse(apiEvent.body ?? "{}"));
      if (!parsed.success) return badRequest(parsed.error.message);

      const now = new Date().toISOString();
      const pipeline: SalesPipeline = {
        pipelineId: randomUUID(),
        tenantId: auth.tenantId,
        name: parsed.data.name.trim(),
        isDefault: false,
        stages: parsed.data.stages?.length
          ? withStageIds(parsed.data.stages)
          : buildDefaultPipeline(auth.tenantId).stages,
        createdAt: now,
        updatedAt: now,
      };
      await createPipeline(pipeline);
      return created(pipeline);
    }

    if (segments[0] === "pipelines" && segments[1]) {
      const pipelineId = segments[1];

      if (method === "GET" && segments.length === 2) {
        const pipeline = await getPipelineById(auth.tenantId, pipelineId);
        if (!pipeline) return notFound("Pipeline not found");
        return ok(pipeline);
      }

      if (method === "PATCH" && segments.length === 2) {
        assertTenantManagerRole(auth);
        const parsed = UpdatePipelineSchema.safeParse(JSON.parse(apiEvent.body ?? "{}"));
        if (!parsed.success) return badRequest(parsed.error.message);

        const updates: Parameters<typeof updatePipeline>[2] = {};
        if (parsed.data.name !== undefined) updates.name = parsed.data.name.trim();
        if (parsed.data.stages !== undefined) updates.stages = withStageIds(parsed.data.stages);
        const updated = await updatePipeline(auth.tenantId, pipelineId, updates);
        if (!updated) return notFound("Pipeline not found");
        return ok(updated);
      }

      if (method === "DELETE" && segments.length === 2) {
        assertTenantManagerRole(auth);
        const deleted = await deletePipeline(auth.tenantId, pipelineId);
        if (!deleted) return badRequest("Cannot delete default or missing pipeline");
        return noContent();
      }
    }

    if (method === "GET" && segments[0] === "opportunities" && segments.length === 1) {
      const limit = params.limit ? parseInt(params.limit, 10) : 50;
      if (isNaN(limit) || limit < 1 || limit > 100) return badRequest("Invalid limit (1-100)");

      const listOpts: Parameters<typeof listOpportunities>[1] = { limit };
      if (params.cursor) listOpts.cursor = params.cursor;
      if (params.pipelineId) listOpts.pipelineId = params.pipelineId;
      else {
        const defaultPipeline = await ensureDefaultPipeline(auth.tenantId);
        listOpts.pipelineId = defaultPipeline.pipelineId;
      }
      if (params.stageId) listOpts.stageId = params.stageId;
      if (params.q) listOpts.q = params.q;

      const result = await listOpportunities(auth.tenantId, listOpts);
      return ok(result);
    }

    if (method === "POST" && segments[0] === "opportunities" && segments.length === 1) {
      const parsed = CreateOpportunitySchema.safeParse(JSON.parse(apiEvent.body ?? "{}"));
      if (!parsed.success) return badRequest(parsed.error.message);

      const opportunity = await buildOpportunity(auth.tenantId, parsed.data);
      if (!opportunity) return badRequest("Invalid pipeline or stage");
      await createOpportunity(opportunity);
      return created(opportunity);
    }

    if (segments[0] === "opportunities" && segments[1]) {
      const opportunityId = segments[1];

      if (method === "GET" && segments[2] === "history") {
        const history = await listStageHistory(auth.tenantId, opportunityId);
        return ok({ items: history });
      }

      if (method === "GET" && segments[2] === "enrollments") {
        const enrollments = await listEnrollmentsByOpportunity(auth.tenantId, opportunityId);
        return ok({ items: enrollments });
      }

      if (method === "GET" && segments.length === 2) {
        const opportunity = await getOpportunityById(auth.tenantId, opportunityId);
        if (!opportunity) return notFound("Opportunity not found");
        return ok(opportunity);
      }

      if (method === "PATCH" && segments.length === 2) {
        const parsed = UpdateOpportunitySchema.safeParse(JSON.parse(apiEvent.body ?? "{}"));
        if (!parsed.success) return badRequest(parsed.error.message);

        const patch: Parameters<typeof updateOpportunity>[2] = {};
        if (parsed.data.title !== undefined) patch.title = parsed.data.title.trim();
        if (parsed.data.amount !== undefined) patch.amount = parsed.data.amount;
        if (parsed.data.currency !== undefined) patch.currency = parsed.data.currency.toUpperCase();
        if (parsed.data.phone !== undefined) patch.phone = normalizePhone(parsed.data.phone);
        if (parsed.data.name !== undefined) patch.name = parsed.data.name;
        if (parsed.data.email !== undefined) patch.email = parsed.data.email;
        if (parsed.data.description !== undefined) patch.description = parsed.data.description;
        if (parsed.data.tags !== undefined) patch.tags = parsed.data.tags;
        if (parsed.data.leadId !== undefined) patch.leadId = parsed.data.leadId;
        if (parsed.data.conversationId !== undefined) patch.conversationId = parsed.data.conversationId;
        if (parsed.data.botId !== undefined) patch.botId = parsed.data.botId;
        if (parsed.data.assignedAdvisorId !== undefined) patch.assignedAdvisorId = parsed.data.assignedAdvisorId;
        if (parsed.data.quotationId !== undefined) patch.quotationId = parsed.data.quotationId;
        if (parsed.data.paymentId !== undefined) patch.paymentId = parsed.data.paymentId;

        const updated = await updateOpportunity(auth.tenantId, opportunityId, patch);
        if (!updated) return notFound("Opportunity not found");
        return ok(updated);
      }

      if (method === "POST" && segments[2] === "stage") {
        const parsed = MoveStageSchema.safeParse(JSON.parse(apiEvent.body ?? "{}"));
        if (!parsed.success) return badRequest(parsed.error.message);

        const updated = await moveOpportunityStage({
          tenantId: auth.tenantId,
          opportunityId,
          stageId: parsed.data.stageId,
          changedBy: auth.userId,
          ...(parsed.data.closeReason ? { closeReason: parsed.data.closeReason } : {}),
        });
        if (!updated) return notFound("Opportunity not found");
        return ok(updated);
      }

      if (method === "POST" && segments[2] === "enroll" && segments[3]) {
        const parsed = EnrollSchema.safeParse(JSON.parse(apiEvent.body ?? "{}"));
        if (!parsed.success) return badRequest(parsed.error.message);

        const active = await listActiveEnrollmentsByOpportunity(auth.tenantId, opportunityId);
        if (active.length > 0) return badRequest("Opportunity already has an active sequence");

        const enrollment = await enrollOpportunityInSequence({
          tenantId: auth.tenantId,
          sequenceId: segments[3]!,
          opportunityId,
          ...(parsed.data.botId ? { botId: parsed.data.botId } : {}),
          ...(parsed.data.assignedAdvisorId ? { assignedAdvisorId: parsed.data.assignedAdvisorId } : {}),
        });
        if (!enrollment) return badRequest("Unable to enroll opportunity");
        return created(enrollment);
      }

      if (method === "DELETE" && segments.length === 2) {
        const deleted = await deleteOpportunity(auth.tenantId, opportunityId);
        if (!deleted) return notFound("Opportunity not found");
        return noContent();
      }
    }

    if (method === "GET" && segments[0] === "sequences" && segments.length === 1) {
      const sequences = await listSequences(auth.tenantId);
      return ok({ items: sequences });
    }

    if (method === "POST" && segments[0] === "sequences" && segments.length === 1) {
      assertTenantManagerRole(auth);
      const parsed = CreateSequenceSchema.safeParse(JSON.parse(apiEvent.body ?? "{}"));
      if (!parsed.success) return badRequest(parsed.error.message);

      const now = new Date().toISOString();
      const sequence: SalesSequence = {
        sequenceId: randomUUID(),
        tenantId: auth.tenantId,
        name: parsed.data.name.trim(),
        enabled: parsed.data.enabled ?? true,
        trigger: parsed.data.trigger ?? "manual",
        steps: withStepIds(parsed.data.steps),
        createdAt: now,
        updatedAt: now,
        ...(parsed.data.triggerStageId ? { triggerStageId: parsed.data.triggerStageId } : {}),
        ...(parsed.data.pipelineId ? { pipelineId: parsed.data.pipelineId } : {}),
      };
      await createSequence(sequence);
      return created(sequence);
    }

    if (segments[0] === "sequences" && segments[1]) {
      const sequenceId = segments[1];

      if (method === "GET" && segments.length === 2) {
        const sequence = await getSequenceById(auth.tenantId, sequenceId);
        if (!sequence) return notFound("Sequence not found");
        return ok(sequence);
      }

      if (method === "PATCH" && segments.length === 2) {
        assertTenantManagerRole(auth);
        const parsed = UpdateSequenceSchema.safeParse(JSON.parse(apiEvent.body ?? "{}"));
        if (!parsed.success) return badRequest(parsed.error.message);

        const updates: Parameters<typeof updateSequence>[2] = {};
        if (parsed.data.name !== undefined) updates.name = parsed.data.name.trim();
        if (parsed.data.enabled !== undefined) updates.enabled = parsed.data.enabled;
        if (parsed.data.trigger !== undefined) updates.trigger = parsed.data.trigger;
        if (parsed.data.triggerStageId !== undefined) updates.triggerStageId = parsed.data.triggerStageId;
        if (parsed.data.pipelineId !== undefined) updates.pipelineId = parsed.data.pipelineId;
        if (parsed.data.steps !== undefined) updates.steps = withStepIds(parsed.data.steps);

        const updated = await updateSequence(auth.tenantId, sequenceId, updates);
        if (!updated) return notFound("Sequence not found");
        return ok(updated);
      }

      if (method === "DELETE" && segments.length === 2) {
        assertTenantManagerRole(auth);
        const deleted = await deleteSequence(auth.tenantId, sequenceId);
        if (!deleted) return notFound("Sequence not found");
        return noContent();
      }
    }

    if (segments[0] === "enrollments" && segments[1]) {
      const enrollmentId = segments[1];
      const action = segments[2];

      if (method === "POST" && action === "pause") {
        const updated = await pauseEnrollment(auth.tenantId, enrollmentId);
        if (!updated) return badRequest("Enrollment cannot be paused");
        return ok(updated);
      }

      if (method === "POST" && action === "resume") {
        const updated = await resumeEnrollment(auth.tenantId, enrollmentId);
        if (!updated) return badRequest("Enrollment cannot be resumed");
        return ok(updated);
      }

      if (method === "POST" && action === "cancel") {
        const updated = await cancelEnrollment(auth.tenantId, enrollmentId);
        if (!updated) return notFound("Enrollment not found");
        return ok(updated);
      }
    }

    if (method === "GET" && segments[0] === "tasks" && segments.length === 1) {
      const limit = params.limit ? parseInt(params.limit, 10) : 50;
      if (isNaN(limit) || limit < 1 || limit > 100) return badRequest("Invalid limit (1-100)");

      const listOpts: Parameters<typeof listSalesTasks>[1] = { limit };
      if (params.cursor) listOpts.cursor = params.cursor;
      if (params.status) listOpts.status = params.status as SalesTask["status"];
      if (params.advisorId) listOpts.advisorId = params.advisorId;

      const result = await listSalesTasks(auth.tenantId, listOpts);
      return ok(result);
    }

    if (method === "POST" && segments[0] === "tasks" && segments.length === 1) {
      const parsed = CreateTaskSchema.safeParse(JSON.parse(apiEvent.body ?? "{}"));
      if (!parsed.success) return badRequest(parsed.error.message);

      const now = new Date().toISOString();
      const task: SalesTask = {
        taskId: randomUUID(),
        tenantId: auth.tenantId,
        title: parsed.data.title.trim(),
        status: "open",
        createdAt: now,
        updatedAt: now,
        ...(parsed.data.description ? { description: parsed.data.description } : {}),
        ...(parsed.data.opportunityId ? { opportunityId: parsed.data.opportunityId } : {}),
        ...(parsed.data.advisorId ? { advisorId: parsed.data.advisorId } : {}),
        ...(parsed.data.dueAt ? { dueAt: parsed.data.dueAt } : {}),
      };
      await createSalesTask(task);
      return created(task);
    }

    if (segments[0] === "tasks" && segments[1]) {
      const taskId = segments[1];

      if (method === "GET" && segments.length === 2) {
        const task = await getSalesTaskById(auth.tenantId, taskId);
        if (!task) return notFound("Task not found");
        return ok(task);
      }

      if (method === "PATCH" && segments.length === 2) {
        const parsed = UpdateTaskSchema.safeParse(JSON.parse(apiEvent.body ?? "{}"));
        if (!parsed.success) return badRequest(parsed.error.message);

        const updates: Parameters<typeof updateSalesTask>[2] = {};
        if (parsed.data.title !== undefined) updates.title = parsed.data.title.trim();
        if (parsed.data.description !== undefined) updates.description = parsed.data.description;
        if (parsed.data.status !== undefined) updates.status = parsed.data.status;
        if (parsed.data.advisorId !== undefined) updates.advisorId = parsed.data.advisorId;
        if (parsed.data.dueAt !== undefined) updates.dueAt = parsed.data.dueAt;

        const updated = await updateSalesTask(auth.tenantId, taskId, updates);
        if (!updated) return notFound("Task not found");
        return ok(updated);
      }
    }

    return badRequest("Route not found");
  } catch (error) {
    return handleError(error);
  }
}
