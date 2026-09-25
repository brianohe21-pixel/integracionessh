import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { randomUUID } from "crypto";
import { z } from "zod";
import {
  resolveRequestAuth,
  assertAdvisorOrMember,
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
  createCompany,
  deleteCompany,
  getCompanyById,
  listCompanies,
  updateCompany,
} from "../../lib/dynamodb/company.repository.js";
import {
  listOpportunityActivities,
} from "../../lib/dynamodb/opportunity-activity.repository.js";
import {
  createPipeline,
  deletePipeline,
  getPipelineById,
  listPipelines,
  updatePipeline,
} from "../../lib/dynamodb/pipeline.repository.js";
import {
  deleteOpportunity,
  getOpportunityById,
  listOpportunities,
  listStageHistory,
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
  getEnrollmentById,
} from "../../lib/dynamodb/sequence-enrollment.repository.js";
import {
  createSalesTask,
  getSalesTaskById,
  listSalesTasks,
  updateSalesTask,
} from "../../lib/dynamodb/sales-task.repository.js";
import {
  createSalesTaskComment,
  deleteSalesTaskComment,
  listSalesTaskComments,
  updateSalesTaskComment,
} from "../../lib/dynamodb/sales-task-comment.repository.js";
import { getLeadById } from "../../lib/dynamodb/lead.repository.js";
import { listMembers } from "../../lib/dynamodb/member.repository.js";
import { getSalesFunnelMetrics } from "../../lib/dynamodb/sales-funnel-metrics.repository.js";
import { moveOpportunityStage } from "../../lib/sales/opportunities/stage.js";
import { getOpportunityDetail } from "../../lib/sales/opportunities/detail.js";
import {
  applyOpportunityPatch,
  persistNewOpportunity,
} from "../../lib/sales/opportunities/create.js";
import {
  canAdvisorAccessOpportunity,
  canAdvisorAccessTask,
  canAdvisorAccessEnrollment,
  resolveAdvisorIdForAuth,
} from "../../lib/sales/opportunities/access.js";
import { enrichOpportunity } from "../../lib/sales/opportunities/forecast.js";
import { recordOpportunityActivity } from "../../lib/sales/opportunities/activity.js";
import {
  cancelEnrollment,
  enrollOpportunityInSequence,
  pauseEnrollment,
  resumeEnrollment,
} from "../../lib/sales/sequences/enroll.js";
import { processSequenceStep } from "../../lib/sales/sequences/executor.js";
import { sendTaskReminder } from "../../lib/sales/tasks/reminder-send.js";
import { syncTaskReminder } from "../../lib/sales/tasks/reminder-schedule.js";
import { findStageById } from "../../lib/dynamodb/pipeline.repository.js";
import { buildDefaultPipeline, findStageByKey } from "../../lib/sales/default-pipeline.js";
import { normalizePhone } from "../../lib/dynamodb/contact.repository.js";
import type {
  Company,
  Opportunity,
  OpportunityLossReason,
  OpportunityStage,
  PipelineStage,
  SalesPipeline,
  SalesSequence,
  SalesSequenceStep,
  SalesTask,
  SalesTaskReminderChannel,
  SalesTaskReminderTarget,
} from "../../types/index.js";

const AttributionSchema = z.object({
  source: z.string().max(64).optional(),
  campaignId: z.string().max(128).optional(),
  flowId: z.string().max(128).optional(),
  submissionId: z.string().max(128).optional(),
  utmSource: z.string().max(128).optional(),
  utmMedium: z.string().max(128).optional(),
  utmCampaign: z.string().max(128).optional(),
  utmContent: z.string().max(128).optional(),
  utmTerm: z.string().max(128).optional(),
  referrer: z.string().max(512).optional(),
  landingPage: z.string().max(512).optional(),
});

const CreateCompanySchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(256).optional(),
  phone: z.string().max(32).optional(),
  website: z.string().max(256).optional(),
  industry: z.string().max(120).optional(),
  notes: z.string().max(2000).optional(),
});

const UpdateCompanySchema = CreateCompanySchema.partial();

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
  conversationId: z.string().min(1).max(256).optional(),
  botId: z.string().uuid().optional(),
  assignedAdvisorId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
  companyName: z.string().max(200).optional(),
  expectedCloseDate: z.string().datetime().optional(),
  sourceId: z.string().max(128).optional(),
  attribution: AttributionSchema.optional(),
});

const UpdateOpportunitySchema = CreateOpportunitySchema.partial().extend({
  quotationId: z.string().uuid().optional(),
  paymentId: z.string().uuid().optional(),
});

const MoveStageSchema = z.object({
  stageId: z.string().uuid(),
  closeReason: z.string().max(500).optional(),
  lossReason: z
    .enum(["price", "competition", "no_response", "timing", "not_qualified", "other"])
    .optional(),
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

const ReminderTargetSchema = z.enum(["advisor", "contact"]);
const ReminderChannelSchema = z.enum(["email", "whatsapp", "platform"]);
const TaskPrioritySchema = z.enum(["low", "medium", "high", "highest"]);
const ReminderExternalSchema = z
  .object({
    email: z.string().email().max(320).optional(),
    whatsapp: z.string().max(32).optional(),
  })
  .refine(
    (value) => Boolean(value.email?.trim() || value.whatsapp?.trim()),
    { message: "External reminder requires email or whatsapp" }
  );

const CreateTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  opportunityId: z.string().uuid().optional(),
  advisorId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  dueAt: z.string().datetime().optional(),
  conversationId: z.string().min(1).max(256).optional(),
  botId: z.string().uuid().optional(),
  contactPhone: z.string().max(32).optional(),
  contactEmail: z.string().email().max(320).optional(),
  contactName: z.string().max(200).optional(),
  priority: TaskPrioritySchema.optional(),
  reminderTargets: z.array(ReminderTargetSchema).max(2).optional(),
  reminderUserIds: z.array(z.string().min(1).max(128)).max(20).optional(),
  reminderExternal: ReminderExternalSchema.nullable().optional(),
  reminderChannels: z.array(ReminderChannelSchema).max(3).optional(),
  reminderMinutesBefore: z.number().int().min(0).max(10080).optional(),
});

const UpdateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(["open", "done", "cancelled"]).optional(),
  advisorId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional().nullable(),
  dueAt: z.string().datetime().optional().nullable(),
  conversationId: z.string().min(1).max(256).optional(),
  botId: z.string().uuid().optional(),
  contactPhone: z.string().max(32).optional(),
  contactEmail: z.string().email().max(320).optional().nullable(),
  contactName: z.string().max(200).optional(),
  priority: TaskPrioritySchema.optional(),
  reminderTargets: z.array(ReminderTargetSchema).max(2).optional(),
  reminderUserIds: z.array(z.string().min(1).max(128)).max(20).optional(),
  reminderExternal: ReminderExternalSchema.nullable().optional(),
  reminderChannels: z.array(ReminderChannelSchema).max(3).optional(),
  reminderMinutesBefore: z.number().int().min(0).max(10080).optional(),
});

const CreateTaskCommentSchema = z.object({
  body: z.string().min(1).max(2000),
});

const UpdateTaskCommentSchema = z.object({
  body: z.string().min(1).max(2000),
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
  const opportunity: Opportunity = {
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
    stageEnteredAt: now,
    lastActivityAt: now,
    ...(data.amount !== undefined ? { amount: data.amount } : {}),
    ...(data.phone ? { phone: normalizePhone(data.phone) } : {}),
    ...(data.name ? { name: data.name } : {}),
    ...(data.email ? { email: data.email } : {}),
    ...(data.description ? { description: data.description } : {}),
    ...(data.leadId ? { leadId: data.leadId } : {}),
    ...(data.conversationId ? { conversationId: data.conversationId } : {}),
    ...(data.botId ? { botId: data.botId } : {}),
    ...(data.assignedAdvisorId ? { assignedAdvisorId: data.assignedAdvisorId } : {}),
    ...(data.companyId ? { companyId: data.companyId } : {}),
    ...(data.companyName ? { companyName: data.companyName } : {}),
    ...(data.expectedCloseDate ? { expectedCloseDate: data.expectedCloseDate } : {}),
    ...(data.sourceId ? { sourceId: data.sourceId } : {}),
  };
  if (data.attribution) {
    opportunity.attribution = data.attribution as NonNullable<Opportunity["attribution"]>;
  }
  return opportunity;
}

function forbidden(message = "Access denied"): APIGatewayProxyResultV2 {
  return {
    statusCode: 403,
    body: JSON.stringify({ error: message }),
  };
}

export async function handler(
  event:
    | APIGatewayProxyEventV2WithJWTAuthorizer
    | {
        action?: string;
        tenantId?: string;
        enrollmentId?: string;
        stepIndex?: number;
        taskId?: string;
      }
): Promise<APIGatewayProxyResultV2 | void> {
  try {
    if ("action" in event && event.action === "run-sequence-step") {
      if (!event.tenantId || !event.enrollmentId || event.stepIndex === undefined) return;
      await processSequenceStep(event.tenantId, event.enrollmentId, event.stepIndex);
      return;
    }

    if ("action" in event && event.action === "send-task-reminder") {
      if (!event.tenantId || !event.taskId) return;
      await sendTaskReminder({ tenantId: event.tenantId, taskId: event.taskId });
      return;
    }

    const apiEvent = event as APIGatewayProxyEventV2WithJWTAuthorizer;
    const auth = await resolveRequestAuth(apiEvent);
    assertAdvisorOrMember(auth);
    await assertAssignedServices(auth.tenantId, "sales");
    const advisorId = await resolveAdvisorIdForAuth(auth);

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

    if (method === "GET" && segments[0] === "companies" && segments.length === 1) {
      const limit = params.limit ? parseInt(params.limit, 10) : 50;
      if (isNaN(limit) || limit < 1 || limit > 100) return badRequest("Invalid limit (1-100)");
      const listOpts: Parameters<typeof listCompanies>[1] = { limit };
      if (params.cursor) listOpts.cursor = params.cursor;
      if (params.q) listOpts.q = params.q;
      const result = await listCompanies(auth.tenantId, listOpts);
      return ok(result);
    }

    if (method === "POST" && segments[0] === "companies" && segments.length === 1) {
      const parsed = CreateCompanySchema.safeParse(JSON.parse(apiEvent.body ?? "{}"));
      if (!parsed.success) return badRequest(parsed.error.message);
      const now = new Date().toISOString();
      const company: Company = {
        companyId: randomUUID(),
        tenantId: auth.tenantId,
        name: parsed.data.name.trim(),
        createdAt: now,
        updatedAt: now,
        ...(parsed.data.email ? { email: parsed.data.email } : {}),
        ...(parsed.data.phone ? { phone: parsed.data.phone } : {}),
        ...(parsed.data.website ? { website: parsed.data.website } : {}),
        ...(parsed.data.industry ? { industry: parsed.data.industry } : {}),
        ...(parsed.data.notes ? { notes: parsed.data.notes } : {}),
      };
      await createCompany(company);
      return created(company);
    }

    if (segments[0] === "companies" && segments[1]) {
      const companyId = segments[1];
      if (method === "GET" && segments.length === 2) {
        const company = await getCompanyById(auth.tenantId, companyId);
        if (!company) return notFound("Company not found");
        return ok(company);
      }
      if (method === "PATCH" && segments.length === 2) {
        const parsed = UpdateCompanySchema.safeParse(JSON.parse(apiEvent.body ?? "{}"));
        if (!parsed.success) return badRequest(parsed.error.message);
        const updates: Parameters<typeof updateCompany>[2] = {};
        if (parsed.data.name !== undefined) updates.name = parsed.data.name.trim();
        if (parsed.data.email !== undefined) updates.email = parsed.data.email;
        if (parsed.data.phone !== undefined) updates.phone = parsed.data.phone;
        if (parsed.data.website !== undefined) updates.website = parsed.data.website;
        if (parsed.data.industry !== undefined) updates.industry = parsed.data.industry;
        if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes;
        const updated = await updateCompany(auth.tenantId, companyId, updates);
        if (!updated) return notFound("Company not found");
        return ok(updated);
      }
      if (method === "DELETE" && segments.length === 2) {
        const deleted = await deleteCompany(auth.tenantId, companyId);
        if (!deleted) return notFound("Company not found");
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
      if (params.companyId) listOpts.companyId = params.companyId;
      if (params.conversationId) listOpts.conversationId = params.conversationId;
      if (advisorId) listOpts.assignedAdvisorId = advisorId;
      else if (params.assignedAdvisorId) listOpts.assignedAdvisorId = params.assignedAdvisorId;

      const result = await listOpportunities(auth.tenantId, listOpts);
      const pipeline = await getPipelineById(auth.tenantId, listOpts.pipelineId!);
      const enrichedItems = result.items.map((item) => {
        const stage = pipeline ? findStageById(pipeline, item.stageId) : undefined;
        return enrichOpportunity(item, stage);
      });
      return ok({ ...result, items: enrichedItems });
    }

    if (method === "POST" && segments[0] === "opportunities" && segments.length === 1) {
      const parsed = CreateOpportunitySchema.safeParse(JSON.parse(apiEvent.body ?? "{}"));
      if (!parsed.success) return badRequest(parsed.error.message);

      const opportunity = await buildOpportunity(auth.tenantId, parsed.data);
      if (!opportunity) return badRequest("Invalid pipeline or stage");
      if (advisorId) opportunity.assignedAdvisorId = advisorId;
      const createdOpportunity = await persistNewOpportunity(opportunity);
      return created(createdOpportunity);
    }

    if (segments[0] === "opportunities" && segments[1]) {
      const opportunityId = segments[1];

      if (method === "GET" && segments[2] === "detail") {
        const existing = await getOpportunityById(auth.tenantId, opportunityId);
        if (!existing) return notFound("Opportunity not found");
        if (!canAdvisorAccessOpportunity(advisorId, existing)) return forbidden();
        const detail = await getOpportunityDetail(auth.tenantId, opportunityId);
        if (!detail) return notFound("Opportunity not found");
        return ok(detail);
      }

      if (method === "GET" && segments[2] === "timeline") {
        const existing = await getOpportunityById(auth.tenantId, opportunityId);
        if (!existing) return notFound("Opportunity not found");
        if (!canAdvisorAccessOpportunity(advisorId, existing)) return forbidden();
        const limit = params.limit ? parseInt(params.limit, 10) : 50;
        if (isNaN(limit) || limit < 1 || limit > 100) return badRequest("Invalid limit (1-100)");
        const timeline = await listOpportunityActivities(auth.tenantId, opportunityId, {
          limit,
          ...(params.cursor ? { cursor: params.cursor } : {}),
        });
        return ok(timeline);
      }

      if (method === "GET" && segments[2] === "history") {
        const existing = await getOpportunityById(auth.tenantId, opportunityId);
        if (!existing) return notFound("Opportunity not found");
        if (!canAdvisorAccessOpportunity(advisorId, existing)) return forbidden();
        const history = await listStageHistory(auth.tenantId, opportunityId);
        return ok({ items: history });
      }

      if (method === "GET" && segments[2] === "enrollments") {
        const existing = await getOpportunityById(auth.tenantId, opportunityId);
        if (!existing) return notFound("Opportunity not found");
        if (!canAdvisorAccessOpportunity(advisorId, existing)) return forbidden();
        const enrollments = await listEnrollmentsByOpportunity(auth.tenantId, opportunityId);
        return ok({ items: enrollments });
      }

      if (method === "GET" && segments.length === 2) {
        const opportunity = await getOpportunityById(auth.tenantId, opportunityId);
        if (!opportunity) return notFound("Opportunity not found");
        if (!canAdvisorAccessOpportunity(advisorId, opportunity)) return forbidden();
        const pipeline = await getPipelineById(auth.tenantId, opportunity.pipelineId);
        const stage = pipeline ? findStageById(pipeline, opportunity.stageId) : undefined;
        return ok(enrichOpportunity(opportunity, stage));
      }

      if (method === "PATCH" && segments.length === 2) {
        const parsed = UpdateOpportunitySchema.safeParse(JSON.parse(apiEvent.body ?? "{}"));
        if (!parsed.success) return badRequest(parsed.error.message);

        const existing = await getOpportunityById(auth.tenantId, opportunityId);
        if (!existing) return notFound("Opportunity not found");
        if (!canAdvisorAccessOpportunity(advisorId, existing)) return forbidden();

        const patch: Parameters<typeof applyOpportunityPatch>[3] = {};
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
        if (parsed.data.companyId !== undefined) patch.companyId = parsed.data.companyId;
        if (parsed.data.companyName !== undefined) patch.companyName = parsed.data.companyName;
        if (parsed.data.expectedCloseDate !== undefined) patch.expectedCloseDate = parsed.data.expectedCloseDate;
        if (parsed.data.sourceId !== undefined) patch.sourceId = parsed.data.sourceId;
        if (parsed.data.attribution !== undefined && parsed.data.attribution) {
          patch.attribution = parsed.data.attribution as NonNullable<Opportunity["attribution"]>;
        }

        const updated = await applyOpportunityPatch(
          auth.tenantId,
          opportunityId,
          existing,
          patch,
          auth.userId
        );
        if (!updated) return notFound("Opportunity not found");
        const pipeline = await getPipelineById(auth.tenantId, updated.pipelineId);
        const stage = pipeline ? findStageById(pipeline, updated.stageId) : undefined;
        return ok(enrichOpportunity(updated, stage));
      }

      if (method === "POST" && segments[2] === "stage") {
        const parsed = MoveStageSchema.safeParse(JSON.parse(apiEvent.body ?? "{}"));
        if (!parsed.success) return badRequest(parsed.error.message);

        const existing = await getOpportunityById(auth.tenantId, opportunityId);
        if (!existing) return notFound("Opportunity not found");
        if (!canAdvisorAccessOpportunity(advisorId, existing)) return forbidden();

        const pipeline = await getPipelineById(auth.tenantId, existing.pipelineId);
        const targetStage = pipeline ? findStageById(pipeline, parsed.data.stageId) : undefined;
        if (targetStage?.outcome === "lost" && !parsed.data.lossReason) {
          return badRequest("lossReason is required when closing as lost");
        }

        const updated = await moveOpportunityStage({
          tenantId: auth.tenantId,
          opportunityId,
          stageId: parsed.data.stageId,
          changedBy: auth.userId,
          ...(parsed.data.closeReason ? { closeReason: parsed.data.closeReason } : {}),
          ...(parsed.data.lossReason
            ? { lossReason: parsed.data.lossReason as OpportunityLossReason }
            : {}),
        });
        if (!updated) return notFound("Opportunity not found");
        const stage = pipeline ? findStageById(pipeline, updated.stageId) : undefined;
        return ok(enrichOpportunity(updated, stage));
      }

      if (method === "POST" && segments[2] === "enroll" && segments[3]) {
        const parsed = EnrollSchema.safeParse(JSON.parse(apiEvent.body ?? "{}"));
        if (!parsed.success) return badRequest(parsed.error.message);

        const existing = await getOpportunityById(auth.tenantId, opportunityId);
        if (!existing) return notFound("Opportunity not found");
        if (!canAdvisorAccessOpportunity(advisorId, existing)) return forbidden();

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
        const existing = await getOpportunityById(auth.tenantId, opportunityId);
        if (!existing) return notFound("Opportunity not found");
        if (!canAdvisorAccessOpportunity(advisorId, existing)) return forbidden();
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
        const enrollment = await getEnrollmentById(auth.tenantId, enrollmentId);
        if (!enrollment) return notFound("Enrollment not found");
        const opp = await getOpportunityById(auth.tenantId, enrollment.opportunityId);
        if (!canAdvisorAccessEnrollment(advisorId, enrollment, opp)) return forbidden();
        const updated = await pauseEnrollment(auth.tenantId, enrollmentId);
        if (!updated) return badRequest("Enrollment cannot be paused");
        return ok(updated);
      }

      if (method === "POST" && action === "resume") {
        const enrollment = await getEnrollmentById(auth.tenantId, enrollmentId);
        if (!enrollment) return notFound("Enrollment not found");
        const opp = await getOpportunityById(auth.tenantId, enrollment.opportunityId);
        if (!canAdvisorAccessEnrollment(advisorId, enrollment, opp)) return forbidden();
        const updated = await resumeEnrollment(auth.tenantId, enrollmentId);
        if (!updated) return badRequest("Enrollment cannot be resumed");
        return ok(updated);
      }

      if (method === "POST" && action === "cancel") {
        const enrollment = await getEnrollmentById(auth.tenantId, enrollmentId);
        if (!enrollment) return notFound("Enrollment not found");
        const opp = await getOpportunityById(auth.tenantId, enrollment.opportunityId);
        if (!canAdvisorAccessEnrollment(advisorId, enrollment, opp)) return forbidden();
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
      if (advisorId) listOpts.advisorId = advisorId;
      else if (params.advisorId) listOpts.advisorId = params.advisorId;
      if (params.opportunityId) listOpts.opportunityId = params.opportunityId;
      if (params.conversationId) listOpts.conversationId = params.conversationId;
      if (params.from) listOpts.from = params.from;
      if (params.to) listOpts.to = params.to;
      if (params.q) listOpts.q = params.q;

      const result = await listSalesTasks(auth.tenantId, listOpts);
      return ok(result);
    }

    if (method === "POST" && segments[0] === "tasks" && segments.length === 1) {
      const parsed = CreateTaskSchema.safeParse(JSON.parse(apiEvent.body ?? "{}"));
      if (!parsed.success) return badRequest(parsed.error.message);

      const now = new Date().toISOString();
      const reminderTargets = uniqueReminderTargets(parsed.data.reminderTargets);
      const reminderChannels = uniqueReminderChannels(parsed.data.reminderChannels);
      const reminderUsers = await resolveReminderUserIds(
        auth.tenantId,
        parsed.data.reminderUserIds
      );
      if (!reminderUsers.ok) return badRequest(reminderUsers.error);
      const reminderUserIds = reminderUsers.userIds;
      const reminderExternal = normalizeReminderExternal(parsed.data.reminderExternal);
      const contactPhone = parsed.data.contactPhone
        ? normalizePhone(parsed.data.contactPhone) || parsed.data.contactPhone
        : undefined;

      const task: SalesTask = {
        taskId: randomUUID(),
        tenantId: auth.tenantId,
        title: parsed.data.title.trim(),
        status: "open",
        createdAt: now,
        updatedAt: now,
        ...(parsed.data.description ? { description: parsed.data.description } : {}),
        ...(parsed.data.opportunityId ? { opportunityId: parsed.data.opportunityId } : {}),
        ...(parsed.data.leadId ? { leadId: parsed.data.leadId } : {}),
        ...(parsed.data.advisorId
          ? { advisorId: parsed.data.advisorId }
          : advisorId
            ? { advisorId }
            : {}),
        ...(parsed.data.dueAt ? { dueAt: parsed.data.dueAt } : {}),
        ...(parsed.data.conversationId ? { conversationId: parsed.data.conversationId } : {}),
        ...(parsed.data.botId ? { botId: parsed.data.botId } : {}),
        ...(contactPhone ? { contactPhone } : {}),
        ...(parsed.data.contactEmail ? { contactEmail: parsed.data.contactEmail } : {}),
        ...(parsed.data.contactName ? { contactName: parsed.data.contactName.trim() } : {}),
        priority: parsed.data.priority ?? "medium",
        ...(reminderTargets.length ? { reminderTargets } : {}),
        ...(reminderUserIds.length ? { reminderUserIds } : {}),
        ...(reminderExternal ? { reminderExternal } : {}),
        ...(reminderChannels.length ? { reminderChannels } : {}),
        ...(parsed.data.reminderMinutesBefore !== undefined
          ? { reminderMinutesBefore: parsed.data.reminderMinutesBefore }
          : reminderChannels.length
            ? { reminderMinutesBefore: 60 }
            : {}),
      };
      if (advisorId && task.advisorId && task.advisorId !== advisorId) {
        return forbidden();
      }
      if (task.opportunityId) {
        const opp = await getOpportunityById(auth.tenantId, task.opportunityId);
        if (!opp) return badRequest("Opportunity not found");
        if (!canAdvisorAccessOpportunity(advisorId, opp)) return forbidden();
      }
      if (task.leadId) {
        const lead = await getLeadById(auth.tenantId, task.leadId);
        if (!lead) return badRequest("Lead not found");
      }
      await createSalesTask(task);
      const withReminder = await syncTaskReminder(task);
      if (task.opportunityId) {
        await recordOpportunityActivity({
          tenantId: auth.tenantId,
          opportunityId: task.opportunityId,
          type: "task_created",
          message: task.title,
          actorId: auth.userId,
          touchLastActivity: true,
        });
      }
      return created(withReminder);
    }

    if (segments[0] === "tasks" && segments[1]) {
      const taskId = segments[1];

      if (method === "GET" && segments.length === 2) {
        const task = await getSalesTaskById(auth.tenantId, taskId);
        if (!task) return notFound("Task not found");
        if (!canAdvisorAccessTask(advisorId, task)) return forbidden();
        return ok(task);
      }

      if (method === "PATCH" && segments.length === 2) {
        const parsed = UpdateTaskSchema.safeParse(JSON.parse(apiEvent.body ?? "{}"));
        if (!parsed.success) return badRequest(parsed.error.message);

        const existingTask = await getSalesTaskById(auth.tenantId, taskId);
        if (!existingTask) return notFound("Task not found");
        if (!canAdvisorAccessTask(advisorId, existingTask)) return forbidden();

        const updates: Parameters<typeof updateSalesTask>[2] = {};
        if (parsed.data.title !== undefined) updates.title = parsed.data.title.trim();
        if (parsed.data.description !== undefined) updates.description = parsed.data.description;
        if (parsed.data.status !== undefined) updates.status = parsed.data.status;
        if (parsed.data.advisorId !== undefined) {
          if (advisorId && parsed.data.advisorId !== advisorId) return forbidden();
          updates.advisorId = parsed.data.advisorId;
        }
        if (parsed.data.leadId !== undefined) {
          if (parsed.data.leadId) {
            const lead = await getLeadById(auth.tenantId, parsed.data.leadId);
            if (!lead) return badRequest("Lead not found");
            updates.leadId = parsed.data.leadId;
          } else {
            updates.leadId = null;
          }
        }
        if (parsed.data.dueAt !== undefined) {
          updates.dueAt = parsed.data.dueAt ?? null;
        }
        if (parsed.data.conversationId !== undefined) {
          updates.conversationId = parsed.data.conversationId;
        }
        if (parsed.data.botId !== undefined) updates.botId = parsed.data.botId;
        if (parsed.data.contactPhone !== undefined) {
          updates.contactPhone =
            normalizePhone(parsed.data.contactPhone) || parsed.data.contactPhone;
        }
        if (parsed.data.contactEmail !== undefined) {
          updates.contactEmail = parsed.data.contactEmail ?? null;
        }
        if (parsed.data.contactName !== undefined) {
          updates.contactName = parsed.data.contactName.trim();
        }
        if (parsed.data.priority !== undefined) {
          updates.priority = parsed.data.priority;
        }
        if (parsed.data.reminderTargets !== undefined) {
          updates.reminderTargets = uniqueReminderTargets(parsed.data.reminderTargets);
        }
        if (parsed.data.reminderUserIds !== undefined) {
          const reminderUsers = await resolveReminderUserIds(
            auth.tenantId,
            parsed.data.reminderUserIds
          );
          if (!reminderUsers.ok) return badRequest(reminderUsers.error);
          updates.reminderUserIds = reminderUsers.userIds;
        }
        if (parsed.data.reminderExternal !== undefined) {
          updates.reminderExternal = normalizeReminderExternal(parsed.data.reminderExternal);
        }
        if (parsed.data.reminderChannels !== undefined) {
          updates.reminderChannels = uniqueReminderChannels(parsed.data.reminderChannels);
        }
        if (parsed.data.reminderMinutesBefore !== undefined) {
          updates.reminderMinutesBefore = parsed.data.reminderMinutesBefore;
        }

        const reminderFieldsChanged =
          parsed.data.dueAt !== undefined ||
          parsed.data.reminderTargets !== undefined ||
          parsed.data.reminderUserIds !== undefined ||
          parsed.data.reminderExternal !== undefined ||
          parsed.data.reminderChannels !== undefined ||
          parsed.data.reminderMinutesBefore !== undefined;

        if (reminderFieldsChanged && existingTask.reminderSentAt) {
          updates.reminderSentAt = null;
          updates.reminderStatus = null;
        }

        const updated = await updateSalesTask(auth.tenantId, taskId, updates);
        if (!updated) return notFound("Task not found");
        const withReminder = await syncTaskReminder(updated);
        if (updated.opportunityId && parsed.data.status === "done") {
          await recordOpportunityActivity({
            tenantId: auth.tenantId,
            opportunityId: updated.opportunityId,
            type: "task_done",
            message: updated.title,
            actorId: auth.userId,
            touchLastActivity: true,
          });
        }
        return ok(withReminder);
      }

      if (segments[2] === "comments" && segments.length === 3) {
        const existingTask = await getSalesTaskById(auth.tenantId, taskId);
        if (!existingTask) return notFound("Task not found");
        if (!canAdvisorAccessTask(advisorId, existingTask)) return forbidden();

        if (method === "GET") {
          const limit = params.limit ? parseInt(params.limit, 10) : 50;
          if (isNaN(limit) || limit < 1 || limit > 100) return badRequest("Invalid limit (1-100)");
          const result = await listSalesTaskComments(auth.tenantId, taskId, {
            limit,
            ...(params.cursor ? { cursor: params.cursor } : {}),
          });
          return ok(result);
        }

        if (method === "POST") {
          const parsed = CreateTaskCommentSchema.safeParse(JSON.parse(apiEvent.body ?? "{}"));
          if (!parsed.success) return badRequest(parsed.error.message);
          const comment = await createSalesTaskComment({
            tenantId: auth.tenantId,
            taskId,
            body: parsed.data.body,
            authorId: auth.userId,
            ...(auth.name ? { authorName: auth.name } : {}),
          });
          return created(comment);
        }
      }

      if (segments[2] === "comments" && segments.length === 4) {
        const commentId = segments[3];
        const existingTask = await getSalesTaskById(auth.tenantId, taskId);
        if (!existingTask) return notFound("Task not found");
        if (!canAdvisorAccessTask(advisorId, existingTask)) return forbidden();

        if (method === "PATCH") {
          const parsed = UpdateTaskCommentSchema.safeParse(JSON.parse(apiEvent.body ?? "{}"));
          if (!parsed.success) return badRequest(parsed.error.message);
          const updated = await updateSalesTaskComment({
            tenantId: auth.tenantId,
            taskId,
            commentId,
            body: parsed.data.body,
          });
          if (!updated) return notFound("Comment not found");
          return ok(updated);
        }

        if (method === "DELETE") {
          const deleted = await deleteSalesTaskComment({
            tenantId: auth.tenantId,
            taskId,
            commentId,
          });
          if (!deleted) return notFound("Comment not found");
          return noContent();
        }
      }
    }

    return badRequest("Route not found");
  } catch (error) {
    return handleError(error);
  }
}

function uniqueReminderTargets(
  values?: SalesTaskReminderTarget[]
): SalesTaskReminderTarget[] {
  if (!values?.length) return [];
  return Array.from(new Set(values));
}

function uniqueReminderUserIds(values?: string[]): string[] {
  if (!values?.length) return [];
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean))
  ).slice(0, 20);
}

async function resolveReminderUserIds(
  tenantId: string,
  values?: string[]
): Promise<{ ok: true; userIds: string[] } | { ok: false; error: string }> {
  const userIds = uniqueReminderUserIds(values);
  if (!userIds.length) return { ok: true, userIds: [] };
  const members = await listMembers(tenantId);
  const enabledIds = new Set(
    members.filter((member) => member.enabled).map((member) => member.userId)
  );
  const invalid = userIds.filter((userId) => !enabledIds.has(userId));
  if (invalid.length) {
    return { ok: false, error: "One or more reminder users are invalid or disabled" };
  }
  return { ok: true, userIds };
}

function normalizeReminderExternal(
  value?: { email?: string; whatsapp?: string } | null
): SalesTask["reminderExternal"] | null {
  if (value === null || value === undefined) return null;
  const email = value.email?.trim().toLowerCase() || undefined;
  const rawWhatsapp = value.whatsapp?.trim() || undefined;
  const whatsapp = rawWhatsapp
    ? normalizePhone(rawWhatsapp) || rawWhatsapp
    : undefined;
  if (!email && !whatsapp) return null;
  return {
    ...(email ? { email } : {}),
    ...(whatsapp ? { whatsapp } : {}),
  };
}

function uniqueReminderChannels(
  values?: SalesTaskReminderChannel[]
): SalesTaskReminderChannel[] {
  if (!values?.length) return [];
  return Array.from(new Set(values));
}
