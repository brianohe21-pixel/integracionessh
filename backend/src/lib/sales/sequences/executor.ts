import { randomUUID } from "crypto";
import { getBot } from "../../dynamodb/bot.repository.js";
import { getTenant } from "../../dynamodb/tenant.repository.js";
import { getOpportunityById } from "../../dynamodb/opportunity.repository.js";
import {
  getEnrollmentById,
  updateEnrollment,
} from "../../dynamodb/sequence-enrollment.repository.js";
import { getSequenceById } from "../../dynamodb/sequence.repository.js";
import { createSalesTask } from "../../dynamodb/sales-task.repository.js";
import { assertCanSendMessages } from "../../billing/assert-plan.js";
import { incrementMessages } from "../../dynamodb/usage.repository.js";
import { checkMarketingRecipients } from "../../compliance/recipient-policy.js";
import { sendTextMessage, sendTemplateMessage, getWhatsAppAccessToken } from "../../whatsapp/client.js";
import { sendEmail } from "../../email/client.js";
import { resolveTenantOutboundFrom } from "../../email/tenant-email.service.js";
import { getBotLocale, templateLanguageForLocale } from "../../i18n/index.js";
import type { SalesSequenceStep } from "../../../types/index.js";
import {
  cancelEnrollmentSchedule,
  computeNextRunAt,
  scheduleEnrollmentStep,
} from "./schedule.js";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";

function sortedSteps(steps: SalesSequenceStep[]): SalesSequenceStep[] {
  return [...steps].sort((a, b) => a.order - b.order);
}

async function executeWhatsAppStep(params: {
  tenantId: string;
  botId?: string;
  phone?: string;
  step: SalesSequenceStep;
}): Promise<void> {
  if (!params.botId || !params.phone) return;

  const bot = await getBot(params.tenantId, params.botId);
  if (!bot?.phoneNumberId) return;

  const tenant = await getTenant(params.tenantId);
  if (tenant) {
    try {
      await assertCanSendMessages(tenant);
    } catch {
      return;
    }
  }

  const normalizedPhone = params.phone.replace(/\D/g, "");
  const { allowed } = await checkMarketingRecipients(params.tenantId, [normalizedPhone]);
  const recipient = allowed[0] ?? normalizedPhone;
  const accessToken = await getWhatsAppAccessToken(params.tenantId, ENVIRONMENT);
  const locale = getBotLocale({}, bot);

  if (params.step.templateName) {
    await sendTemplateMessage({
      phoneNumberId: bot.phoneNumberId,
      to: recipient,
      templateName: params.step.templateName,
      language: params.step.templateLanguage || templateLanguageForLocale(locale),
      accessToken,
    });
  } else if (params.step.messageText) {
    await sendTextMessage({
      phoneNumberId: bot.phoneNumberId,
      to: recipient,
      text: params.step.messageText,
      accessToken,
    });
  } else {
    return;
  }

  await incrementMessages(params.tenantId);
}

async function executeEmailStep(params: {
  tenantId: string;
  email?: string;
  step: SalesSequenceStep;
}): Promise<void> {
  if (!params.email || !params.step.emailSubject || !params.step.messageText) return;

  const from = await resolveTenantOutboundFrom(params.tenantId);
  await sendEmail({
    to: [params.email],
    subject: params.step.emailSubject,
    text: params.step.messageText,
    ...(from ? { from } : {}),
  });
}

async function executeTaskStep(params: {
  tenantId: string;
  opportunityId: string;
  enrollmentId: string;
  advisorId?: string;
  step: SalesSequenceStep;
}): Promise<void> {
  const now = new Date();
  const dueAt = computeNextRunAt(params.step.taskDueMinutes ?? 60, now);
  await createSalesTask({
    taskId: randomUUID(),
    tenantId: params.tenantId,
    opportunityId: params.opportunityId,
    enrollmentId: params.enrollmentId,
    title: params.step.taskTitle?.trim() || "Follow up",
    ...(params.step.taskDescription ? { description: params.step.taskDescription } : {}),
    dueAt,
    status: "open",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    ...(params.step.assignToAdvisor && params.advisorId ? { advisorId: params.advisorId } : {}),
  });
}

export async function processSequenceStep(
  tenantId: string,
  enrollmentId: string,
  stepIndex: number
): Promise<void> {
  const enrollment = await getEnrollmentById(tenantId, enrollmentId);
  if (!enrollment || enrollment.status !== "active") return;
  if (enrollment.currentStepIndex !== stepIndex) return;

  const sequence = await getSequenceById(tenantId, enrollment.sequenceId);
  if (!sequence) return;

  const steps = sortedSteps(sequence.steps);
  const step = steps[stepIndex];
  if (!step) {
    await cancelEnrollmentSchedule(enrollment.scheduleName);
    await updateEnrollment(tenantId, enrollmentId, {
      status: "completed",
      lastRunAt: new Date().toISOString(),
    });
    return;
  }

  const opportunity = await getOpportunityById(tenantId, enrollment.opportunityId);
  if (!opportunity || opportunity.closedAt) {
    await cancelEnrollmentSchedule(enrollment.scheduleName);
    await updateEnrollment(tenantId, enrollmentId, {
      status: "cancelled",
    });
    return;
  }

  if (step.channel === "whatsapp") {
    await executeWhatsAppStep({
      tenantId,
      ...(enrollment.botId ? { botId: enrollment.botId } : {}),
      ...((enrollment.contactPhone ?? opportunity.phone)
        ? { phone: enrollment.contactPhone ?? opportunity.phone }
        : {}),
      step,
    });
  } else if (step.channel === "email") {
    await executeEmailStep({
      tenantId,
      ...((enrollment.contactEmail ?? opportunity.email)
        ? { email: enrollment.contactEmail ?? opportunity.email }
        : {}),
      step,
    });
  } else if (step.channel === "task") {
    await executeTaskStep({
      tenantId,
      opportunityId: enrollment.opportunityId,
      enrollmentId,
      ...(enrollment.assignedAdvisorId ? { advisorId: enrollment.assignedAdvisorId } : {}),
      step,
    });
  }

  const { recordOpportunityActivity } = await import("../opportunities/activity.js");
  await recordOpportunityActivity({
    tenantId,
    opportunityId: enrollment.opportunityId,
    type: "sequence_step",
    message: step.channel,
    metadata: { stepIndex, sequenceId: enrollment.sequenceId },
    touchLastActivity: true,
  }).catch(() => undefined);

  const now = new Date().toISOString();
  const nextIndex = stepIndex + 1;
  const nextStep = steps[nextIndex];

  if (!nextStep) {
    await cancelEnrollmentSchedule(enrollment.scheduleName);
    await updateEnrollment(tenantId, enrollmentId, {
      status: "completed",
      currentStepIndex: nextIndex,
      lastRunAt: now,
    });
    return;
  }

  const nextRunAt = computeNextRunAt(nextStep.delayMinutes);
  const updatedEnrollment = {
    ...enrollment,
    currentStepIndex: nextIndex,
    nextRunAt,
    lastRunAt: now,
    updatedAt: now,
  };
  const scheduleName = await scheduleEnrollmentStep(updatedEnrollment, nextIndex, nextRunAt);
  await updateEnrollment(tenantId, enrollmentId, {
    currentStepIndex: nextIndex,
    nextRunAt,
    lastRunAt: now,
    ...(scheduleName ? { scheduleName } : {}),
  });
}
