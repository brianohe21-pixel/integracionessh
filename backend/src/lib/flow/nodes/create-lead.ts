import type { FlowNode, FlowRun } from "../../../types/index.js";
import type { FlowExecutionContext, NodeExecutionResult } from "../types.js";
import { buildBindingContext, resolveBindingValue } from "../binding.js";
import { getNextNodeId } from "../graph.js";
import { normalizePhone } from "../../dynamodb/contact.repository.js";
import { createLeadFromFormData } from "../../leads/form-lead.js";
import { requireConversation } from "../types.js";

export async function executeCreateLeadNode(
  node: FlowNode,
  ctx: FlowExecutionContext,
  run: FlowRun
): Promise<NodeExecutionResult> {
  const bindingContext = buildBindingContext({
    formPayload: ctx.formPayload,
    variables: run.variables,
  });

  const phone = normalizePhone(resolveBindingValue(node.data.leadPhoneBinding, bindingContext));
  if (!phone) throw new Error("Valid phone binding is required");
  if (!ctx.botId) throw new Error("Add an assign bot node before creating leads");

  const name = resolveBindingValue(node.data.leadNameBinding, bindingContext) || undefined;
  const email = resolveBindingValue(node.data.leadEmailBinding, bindingContext) || undefined;

  const lead = await createLeadFromFormData({
    tenantId: ctx.tenantId,
    botId: ctx.botId,
    phone,
    ...(name ? { name } : {}),
    ...(email ? { email } : {}),
    ...(node.data.leadTags?.length ? { tags: node.data.leadTags } : {}),
    ...(run.eventSubmissionId ? { sourceId: run.eventSubmissionId } : {}),
    ...(ctx.conversation
      ? { linkConversationId: requireConversation(ctx).conversationId }
      : {}),
  });

  return {
    nextNodeId: getNextNodeId(ctx.flow, node.id),
    halt: false,
    wait: false,
    variables: {
      lead_id: lead.leadId,
      contact_phone: phone,
    },
    output: lead.leadId,
  };
}
