import { getAdvisor } from "../../dynamodb/advisor.repository.js";
import { getCompanyById } from "../../dynamodb/company.repository.js";
import { getContactByPhone } from "../../dynamodb/contact.repository.js";
import { findConversationById } from "../../dynamodb/conversation.repository.js";
import { getLeadById } from "../../dynamodb/lead.repository.js";
import {
  getOpportunityById,
  listStageHistory,
} from "../../dynamodb/opportunity.repository.js";
import { getPaymentRequest } from "../../dynamodb/payment-request.repository.js";
import { findStageById, getPipelineById } from "../../dynamodb/pipeline.repository.js";
import {
  getQuotation,
  listQuotationsForConversation,
} from "../../dynamodb/quotation.repository.js";
import { listEnrollmentsByOpportunity } from "../../dynamodb/sequence-enrollment.repository.js";
import { listSalesTasksByOpportunity } from "../../dynamodb/sales-task.repository.js";
import { listPaymentRequestsForBot } from "../../dynamodb/payment-request.repository.js";
import type { OpportunityDetail } from "../../../types/index.js";
import { enrichOpportunity } from "./forecast.js";

const RELATION_LIMIT = 20;

export async function getOpportunityDetail(
  tenantId: string,
  opportunityId: string
): Promise<OpportunityDetail | null> {
  const opportunity = await getOpportunityById(tenantId, opportunityId);
  if (!opportunity) return null;

  const pipeline = await getPipelineById(tenantId, opportunity.pipelineId);
  const stage = pipeline ? findStageById(pipeline, opportunity.stageId) : undefined;

  const [
    company,
    advisor,
    lead,
    contact,
    conversation,
    quotation,
    payment,
    tasksResult,
    enrollments,
    stageHistory,
  ] = await Promise.all([
    opportunity.companyId
      ? getCompanyById(tenantId, opportunity.companyId)
      : Promise.resolve(null),
    opportunity.assignedAdvisorId
      ? getAdvisor(tenantId, opportunity.assignedAdvisorId)
      : Promise.resolve(null),
    opportunity.leadId ? getLeadById(tenantId, opportunity.leadId) : Promise.resolve(null),
    opportunity.phone
      ? getContactByPhone(tenantId, opportunity.phone)
      : Promise.resolve(null),
    opportunity.conversationId
      ? findConversationById(tenantId, opportunity.conversationId)
      : Promise.resolve(null),
    opportunity.quotationId
      ? getQuotation(tenantId, opportunity.quotationId)
      : Promise.resolve(null),
    opportunity.paymentId
      ? getPaymentRequest(tenantId, opportunity.paymentId)
      : Promise.resolve(null),
    listSalesTasksByOpportunity(tenantId, opportunityId, { limit: RELATION_LIMIT }),
    listEnrollmentsByOpportunity(tenantId, opportunityId),
    listStageHistory(tenantId, opportunityId),
  ]);

  let quotations: Awaited<ReturnType<typeof listQuotationsForConversation>> = [];
  let payments: Awaited<ReturnType<typeof listPaymentRequestsForBot>> = [];

  if (conversation) {
    quotations = await listQuotationsForConversation({
      tenantId,
      botId: conversation.botId,
      conversationId: conversation.conversationId,
      limit: RELATION_LIMIT,
    });
    payments = await listPaymentRequestsForBot({
      tenantId,
      botId: conversation.botId,
      limit: RELATION_LIMIT,
    }).then((items) =>
      items.filter((item) => item.conversationId === conversation.conversationId)
    );
  }

  const detail: OpportunityDetail = {
    opportunity: enrichOpportunity(opportunity, stage),
    tasks: tasksResult.items,
    enrollments,
    stageHistory,
    ...(pipeline
      ? {
          pipeline: {
            pipelineId: pipeline.pipelineId,
            name: pipeline.name,
            stages: pipeline.stages,
          },
        }
      : {}),
    ...(company ? { company } : {}),
    ...(advisor ? { advisor: { advisorId: advisor.advisorId, name: advisor.name } } : {}),
    ...(lead ? { lead } : {}),
    ...(contact ? { contact } : {}),
    ...(conversation
      ? {
          conversation: {
            conversationId: conversation.conversationId,
            botId: conversation.botId,
            channel: conversation.channel ?? "whatsapp",
            phoneNumber: conversation.phoneNumber,
            status: conversation.status,
            lastMessageAt: conversation.lastMessageAt,
            ...(conversation.contactName ? { contactName: conversation.contactName } : {}),
            ...(conversation.workflowStatus
              ? { workflowStatus: conversation.workflowStatus }
              : {}),
            ...(conversation.assignedAdvisorId
              ? { assignedAdvisorId: conversation.assignedAdvisorId }
              : {}),
          },
        }
      : {}),
    ...(quotation ? { quotation } : {}),
    ...(payment ? { payment } : {}),
    ...(quotations.length > 0 ? { quotations } : {}),
    ...(payments.length > 0 ? { payments } : {}),
  };

  return detail;
}
