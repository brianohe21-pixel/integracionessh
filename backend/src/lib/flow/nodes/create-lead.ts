import type { FlowNode, FlowRun } from "../../../types/index.js";
import type { FlowExecutionContext, NodeExecutionResult } from "../types.js";
import {
  buildBindingContext,
  conversationBindingFromContext,
  resolveBindingValue,
  resolveContactIdentity,
} from "../binding.js";
import { getNextNodeId } from "../graph.js";
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
    conversation: conversationBindingFromContext(ctx),
  });

  const phone = resolveContactIdentity(
    resolveBindingValue(node.data.leadPhoneBinding, bindingContext)
  );
  if (!phone) {
    return {
      nextNodeId: getNextNodeId(ctx.flow, node.id),
      halt: false,
      wait: false,
      error: "Valid phone binding is required",
      output: "skipped: missing phone",
    };
  }
  if (!ctx.botId) throw new Error("Assign the flow to an agent before creating leads");

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
