import {
  createFlowEventSubmission,
} from "../dynamodb/flow-event.repository.js";
import { getFlowDefinition } from "../dynamodb/flow.repository.js";
import {
  createHostedFormSubmission,
  makeHostedFormSubmissionId,
} from "../dynamodb/hosted-form.repository.js";
import { enqueueFlowEventSubmission, makeSubmissionId } from "../flow/enqueue-event.js";
import { isWebhookReceivingFlow } from "../flow/webhook-flow.js";
import { emitIntegrationEvent } from "../integrations/emit.js";
import { createLeadFromFormData } from "../leads/form-lead.js";
import type { HostedForm, HostedFormSubmission } from "../../types/index.js";
import { mappedCrmValues, validateAndNormalizeSubmission } from "./validate.js";

export async function submitHostedForm(params: {
  form: HostedForm;
  rawPayload: Record<string, unknown>;
}): Promise<HostedFormSubmission> {
  const payload = validateAndNormalizeSubmission(params.form.fields, params.rawPayload);
  const now = new Date().toISOString();
  const submissionId = makeHostedFormSubmissionId();
  const crm = mappedCrmValues(params.form.crmMapping, payload);

  let leadId: string | undefined;
  if (params.form.createLeadOnSubmit && params.form.botId && crm.phone) {
    const lead = await createLeadFromFormData({
      tenantId: params.form.tenantId,
      botId: params.form.botId,
      phone: crm.phone,
      ...(crm.name ? { name: crm.name } : {}),
      ...(crm.email ? { email: crm.email } : {}),
      ...(params.form.tags?.length ? { tags: params.form.tags } : {}),
      sourceId: submissionId,
    });
    leadId = lead.leadId;
  }

  let flowSubmissionId: string | undefined;
  if (params.form.flowId) {
    const flow = await getFlowDefinition(params.form.tenantId, params.form.flowId);
    if (flow?.enabled && isWebhookReceivingFlow(flow.nodes)) {
      const flowSubmission = await createFlowEventSubmission({
        submissionId: makeSubmissionId(),
        tenantId: params.form.tenantId,
        flowId: flow.flowId,
        hookKey: `hosted-form:${params.form.formId}`,
        payload,
        status: "accepted",
        createdAt: now,
        updatedAt: now,
      });
      await enqueueFlowEventSubmission(flowSubmission);
      flowSubmissionId = flowSubmission.submissionId;
    }
  }

  const submission = await createHostedFormSubmission({
    submissionId,
    tenantId: params.form.tenantId,
    formId: params.form.formId,
    payload,
    createdAt: now,
    ...(leadId ? { leadId } : {}),
    ...(flowSubmissionId ? { flowSubmissionId } : {}),
  });

  await emitIntegrationEvent(params.form.tenantId, "form.submitted", {
    event: "form.submitted",
    timestamp: now,
    tenantId: params.form.tenantId,
    data: {
      formId: params.form.formId,
      botId: params.form.botId,
      submissionId,
      payload,
      ...(leadId ? { leadId } : {}),
      ...(flowSubmissionId ? { flowSubmissionId } : {}),
    },
  }).catch((err) => console.error("Failed to emit form.submitted:", err));

  return submission;
}
