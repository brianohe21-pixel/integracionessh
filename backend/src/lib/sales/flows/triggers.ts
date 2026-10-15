import {
  createFlowEventSubmission,
  putFlowEventIdempotencyRecord,
} from "../../dynamodb/flow-event.repository.js";
import { listFlowDefinitions } from "../../dynamodb/flow.repository.js";
import { getFlowEntryNode } from "../../flow/entry-node.js";
import {
  enqueueFlowEventSubmissionSafe,
  makeSubmissionId,
} from "../../flow/enqueue-event.js";
import type { Opportunity, OpportunityStage } from "../../../types/index.js";

function triggerNodeMatchesStage(
  triggerStageKey: OpportunityStage | undefined,
  stageKey: OpportunityStage
): boolean {
  if (!triggerStageKey) return true;
  return triggerStageKey === stageKey;
}

function isOpportunityStageEnteredFlow(flowNodes: Parameters<typeof getFlowEntryNode>[0]): boolean {
  const entry = getFlowEntryNode(flowNodes);
  if (!entry) return false;
  if (entry.type === "opportunity_stage_trigger") return true;
  return entry.data.triggerType === "opportunity_stage_entered";
}

export async function triggerFlowsForOpportunityStageEntered(params: {
  tenantId: string;
  opportunity: Opportunity;
  fromStageKey: OpportunityStage;
  toStageKey: OpportunityStage;
  toStageId: string;
}): Promise<void> {
  const flows = await listFlowDefinitions(params.tenantId);
  const matching = flows.filter((flow) => {
    if (!flow.enabled) return false;
    if (!isOpportunityStageEnteredFlow(flow.nodes)) return false;
    const entry = getFlowEntryNode(flow.nodes);
    return triggerNodeMatchesStage(entry?.data.triggerStageKey, params.toStageKey);
  });

  if (matching.length === 0) return;

  const now = new Date().toISOString();
  const stageEnteredAt = params.opportunity.stageEnteredAt ?? now;
  const payload: Record<string, unknown> = {
    opportunity_id: params.opportunity.opportunityId,
    opportunity_stage: params.toStageKey,
    opportunity_title: params.opportunity.title,
    pipeline_id: params.opportunity.pipelineId,
    stage_id: params.toStageId,
    from_stage: params.fromStageKey,
    to_stage: params.toStageKey,
    ...(params.opportunity.phone
      ? { contact_phone: params.opportunity.phone, phone: params.opportunity.phone }
      : {}),
    ...(params.opportunity.name ? { contact_name: params.opportunity.name } : {}),
    ...(params.opportunity.email ? { contact_email: params.opportunity.email } : {}),
    ...(params.opportunity.amount != null
      ? { opportunity_amount: String(params.opportunity.amount) }
      : {}),
    ...(params.opportunity.currency
      ? { opportunity_currency: params.opportunity.currency }
      : {}),
  };

  for (const flow of matching) {
    const submissionId = makeSubmissionId();
    const idempotencyKey = `opportunity-stage:${params.opportunity.opportunityId}:${params.toStageId}:${stageEnteredAt}`;
    const claimed = await putFlowEventIdempotencyRecord({
      tenantId: params.tenantId,
      flowId: flow.flowId,
      idempotencyKey,
      submissionId,
      createdAt: now,
    });
    if (!claimed) continue;

    const submission = await createFlowEventSubmission({
      submissionId,
      tenantId: params.tenantId,
      flowId: flow.flowId,
      hookKey: `opportunity-stage:${params.toStageKey}`,
      idempotencyKey,
      payload,
      status: "accepted",
      createdAt: now,
      updatedAt: now,
    });

    await enqueueFlowEventSubmissionSafe(submission).catch((err) => {
      console.error("Failed to enqueue opportunity stage flow", {
        flowId: flow.flowId,
        opportunityId: params.opportunity.opportunityId,
        error: err,
      });
    });
  }
}
