import { listOpportunities, getOpportunityById } from "../../dynamodb/opportunity.repository.js";
import { getPipelineById } from "../../dynamodb/pipeline.repository.js";
import { findStageByKey } from "../default-pipeline.js";
import { applyOpportunityPatch } from "./create.js";
import { moveOpportunityStage } from "./stage.js";
import { recordOpportunityActivity } from "./activity.js";
import type { Opportunity } from "../../../types/index.js";

export async function syncOpportunityFromQuotation(params: {
  tenantId: string;
  conversationId: string;
  quotationId: string;
  paymentId: string;
  totalInCents: number;
  quotationNumber: string;
}): Promise<Opportunity | null> {
  const list = await listOpportunities(params.tenantId, {
    conversationId: params.conversationId,
    limit: 50,
  });

  const open = list.items.filter((item) => !item.closedAt);
  if (open.length !== 1) return null;

  const opportunity = open[0]!;
  const amount = params.totalInCents / 100;

  const patched = await applyOpportunityPatch(
    params.tenantId,
    opportunity.opportunityId,
    opportunity,
    {
      quotationId: params.quotationId,
      paymentId: params.paymentId,
      amount,
      currency: "COP",
    }
  );
  if (!patched) return null;

  const pipeline = await getPipelineById(params.tenantId, patched.pipelineId);
  const quotedStage = pipeline ? findStageByKey(pipeline, "quoted") : undefined;

  let result = patched;
  if (
    quotedStage &&
    patched.stageId !== quotedStage.stageId &&
    patched.stage !== "won" &&
    patched.stage !== "lost" &&
    patched.stage !== "negotiation"
  ) {
    const moved = await moveOpportunityStage({
      tenantId: params.tenantId,
      opportunityId: patched.opportunityId,
      stageId: quotedStage.stageId,
    });
    if (moved) result = moved;
  }

  await recordOpportunityActivity({
    tenantId: params.tenantId,
    opportunityId: result.opportunityId,
    type: "quotation_sent",
    message: params.quotationNumber,
    metadata: {
      quotationId: params.quotationId,
      paymentId: params.paymentId,
      totalInCents: params.totalInCents,
    },
    touchLastActivity: true,
  });

  return result;
}

export async function syncOpportunityFromPayment(params: {
  tenantId: string;
  paymentId: string;
  quotationId?: string;
  conversationId?: string;
  amountInCents: number;
}): Promise<Opportunity | null> {
  let opportunity: Opportunity | null = null;

  if (params.quotationId) {
    const list = await listOpportunities(params.tenantId, { limit: 100 });
    opportunity =
      list.items.find((item) => item.quotationId === params.quotationId) ?? null;
  }

  if (!opportunity && params.conversationId) {
    const list = await listOpportunities(params.tenantId, {
      conversationId: params.conversationId,
      limit: 50,
    });
    const open = list.items.filter((item) => !item.closedAt);
    if (open.length === 1) opportunity = open[0]!;
  }

  if (!opportunity) return null;

  const existing = await getOpportunityById(params.tenantId, opportunity.opportunityId);
  if (!existing) return null;

  const patch: Parameters<typeof applyOpportunityPatch>[3] = {
    paymentId: params.paymentId,
    lastActivityAt: new Date().toISOString(),
  };
  if (params.quotationId && !existing.quotationId) {
    patch.quotationId = params.quotationId;
  }
  if (!existing.amount || existing.amount <= 0) {
    patch.amount = params.amountInCents / 100;
    patch.currency = "COP";
  }

  const updated = await applyOpportunityPatch(
    params.tenantId,
    existing.opportunityId,
    existing,
    patch
  );
  if (!updated) return null;

  await recordOpportunityActivity({
    tenantId: params.tenantId,
    opportunityId: updated.opportunityId,
    type: "payment_paid",
    message: `${params.amountInCents / 100} COP`,
    metadata: {
      paymentId: params.paymentId,
      ...(params.quotationId ? { quotationId: params.quotationId } : {}),
    },
    touchLastActivity: true,
  });

  if (updated.closedAt || updated.stage === "won" || updated.stage === "lost") {
    return updated;
  }

  const pipeline = await getPipelineById(params.tenantId, updated.pipelineId);
  const wonStage = pipeline ? findStageByKey(pipeline, "won") : undefined;
  if (!wonStage || updated.stageId === wonStage.stageId) return updated;

  const moved = await moveOpportunityStage({
    tenantId: params.tenantId,
    opportunityId: updated.opportunityId,
    stageId: wonStage.stageId,
    closeReason: "payment_received",
  });

  return moved ?? updated;
}
