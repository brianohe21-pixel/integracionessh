import type { FlowNode, FlowRun } from "../../../types/index.js";
import type { FlowExecutionContext, NodeExecutionResult } from "../types.js";
import { buildBindingContext, resolveBindingValue } from "../binding.js";
import { getNextNodeId } from "../graph.js";
import { normalizePhone } from "../../dynamodb/contact.repository.js";
import { createOpportunityFromFormData } from "../../opportunities/form-opportunity.js";

export async function executeCreateOpportunityNode(
  node: FlowNode,
  ctx: FlowExecutionContext,
  run: FlowRun
): Promise<NodeExecutionResult> {
  const bindingContext = buildBindingContext({
    formPayload: ctx.formPayload,
    variables: run.variables,
  });

  const title = resolveBindingValue(node.data.opportunityTitleBinding, bindingContext).trim();
  if (!title) throw new Error("Opportunity title binding is required");

  const phone = normalizePhone(resolveBindingValue(node.data.opportunityPhoneBinding, bindingContext));
  if (!phone) throw new Error("Valid phone binding is required");

  const name = resolveBindingValue(node.data.opportunityNameBinding, bindingContext) || undefined;
  const email = resolveBindingValue(node.data.opportunityEmailBinding, bindingContext) || undefined;
  const description =
    resolveBindingValue(node.data.opportunityDescriptionBinding, bindingContext) || undefined;
  const amount = resolveBindingValue(node.data.opportunityAmountBinding, bindingContext) || undefined;

  const opportunity = await createOpportunityFromFormData({
    tenantId: ctx.tenantId,
    ...(ctx.botId ? { botId: ctx.botId } : {}),
    title,
    phone,
    ...(amount ? { amount } : {}),
    ...(node.data.opportunityCurrency ? { currency: node.data.opportunityCurrency } : {}),
    ...(node.data.opportunityStage ? { stage: node.data.opportunityStage } : {}),
    ...(name ? { name } : {}),
    ...(email ? { email } : {}),
    ...(description ? { description } : {}),
    ...(node.data.opportunityTags?.length ? { tags: node.data.opportunityTags } : {}),
    ...(run.variables?.lead_id ? { leadId: run.variables.lead_id } : {}),
    ...(run.eventSubmissionId ? { sourceId: run.eventSubmissionId } : {}),
  });

  return {
    nextNodeId: getNextNodeId(ctx.flow, node.id),
    halt: false,
    wait: false,
    variables: {
      opportunity_id: opportunity.opportunityId,
      opportunity_title: opportunity.title,
      contact_phone: phone,
    },
    output: opportunity.opportunityId,
  };
}
