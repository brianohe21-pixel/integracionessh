import { randomUUID } from "crypto";
import { getOpportunityById } from "../../dynamodb/opportunity.repository.js";
import {
  createEnrollment,
  getEnrollmentById,
  updateEnrollment,
} from "../../dynamodb/sequence-enrollment.repository.js";
import { getSequenceById } from "../../dynamodb/sequence.repository.js";
import type { SequenceEnrollment } from "../../../types/index.js";
import {
  cancelEnrollmentSchedule,
  computeNextRunAt,
  scheduleEnrollmentStep,
} from "./schedule.js";

export async function enrollOpportunityInSequence(params: {
  tenantId: string;
  sequenceId: string;
  opportunityId: string;
  botId?: string;
  assignedAdvisorId?: string;
}): Promise<SequenceEnrollment | null> {
  const sequence = await getSequenceById(params.tenantId, params.sequenceId);
  if (!sequence || !sequence.enabled || sequence.steps.length === 0) return null;

  const opportunity = await getOpportunityById(params.tenantId, params.opportunityId);
  if (!opportunity) return null;

  const now = new Date().toISOString();
  const firstStep = [...sequence.steps].sort((a, b) => a.order - b.order)[0]!;
  const nextRunAt = computeNextRunAt(firstStep.delayMinutes);

  const enrollment: SequenceEnrollment = {
    enrollmentId: randomUUID(),
    tenantId: params.tenantId,
    sequenceId: params.sequenceId,
    opportunityId: params.opportunityId,
    currentStepIndex: 0,
    status: "active",
    nextRunAt,
    createdAt: now,
    updatedAt: now,
    ...(opportunity.phone ? { contactPhone: opportunity.phone } : {}),
    ...(opportunity.email ? { contactEmail: opportunity.email } : {}),
    ...(params.botId ? { botId: params.botId } : opportunity.botId ? { botId: opportunity.botId } : {}),
    ...(params.assignedAdvisorId
      ? { assignedAdvisorId: params.assignedAdvisorId }
      : opportunity.assignedAdvisorId
        ? { assignedAdvisorId: opportunity.assignedAdvisorId }
        : {}),
  };

  const scheduleName = await scheduleEnrollmentStep(enrollment, 0, nextRunAt);
  await createEnrollment({
    ...enrollment,
    ...(scheduleName ? { scheduleName } : {}),
  });

  return getEnrollmentById(params.tenantId, enrollment.enrollmentId);
}

export async function pauseEnrollment(
  tenantId: string,
  enrollmentId: string
): Promise<SequenceEnrollment | null> {
  const existing = await getEnrollmentById(tenantId, enrollmentId);
  if (!existing || existing.status !== "active") return null;

  await cancelEnrollmentSchedule(existing.scheduleName);
  return updateEnrollment(tenantId, enrollmentId, {
    status: "paused",
  });
}

export async function resumeEnrollment(
  tenantId: string,
  enrollmentId: string
): Promise<SequenceEnrollment | null> {
  const existing = await getEnrollmentById(tenantId, enrollmentId);
  if (!existing || existing.status !== "paused") return null;

  const nextRunAt = computeNextRunAt(0);
  const scheduleName = await scheduleEnrollmentStep(existing, existing.currentStepIndex, nextRunAt);
  return updateEnrollment(tenantId, enrollmentId, {
    status: "active",
    nextRunAt,
    ...(scheduleName ? { scheduleName } : {}),
  });
}

export async function cancelEnrollment(
  tenantId: string,
  enrollmentId: string
): Promise<SequenceEnrollment | null> {
  const existing = await getEnrollmentById(tenantId, enrollmentId);
  if (!existing) return null;

  await cancelEnrollmentSchedule(existing.scheduleName);
  return updateEnrollment(tenantId, enrollmentId, {
    status: "cancelled",
  });
}
