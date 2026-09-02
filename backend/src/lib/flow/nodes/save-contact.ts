import type { FlowNode, FlowRun } from "../../../types/index.js";
import type { FlowExecutionContext, NodeExecutionResult } from "../types.js";
import { buildBindingContext, resolveBindingValue } from "../binding.js";
import { getNextNodeId } from "../graph.js";
import { normalizePhone } from "../../dynamodb/contact.repository.js";
import { saveContactFromFormData } from "../../leads/form-lead.js";
import { requireConversation } from "../types.js";

export async function executeSaveContactNode(
  node: FlowNode,
  ctx: FlowExecutionContext,
  run: FlowRun
): Promise<NodeExecutionResult> {
  const bindingContext = buildBindingContext({
    formPayload: ctx.formPayload,
    variables: run.variables,
  });

  const phone = normalizePhone(
    resolveBindingValue(node.data.contactPhoneBinding, bindingContext)
  );
  if (!phone) throw new Error("Valid phone binding is required");

  const name = resolveBindingValue(node.data.contactNameBinding, bindingContext) || undefined;
  const email = resolveBindingValue(node.data.contactEmailBinding, bindingContext) || undefined;

  await saveContactFromFormData({
    tenantId: ctx.tenantId,
    ...(ctx.botId ? { botId: ctx.botId } : {}),
    phone,
    ...(name ? { name } : {}),
    ...(email ? { email } : {}),
    ...(node.data.contactTags?.length ? { tags: node.data.contactTags } : {}),
    ...(ctx.conversation
      ? { linkConversationId: requireConversation(ctx).conversationId }
      : {}),
  });

  return {
    nextNodeId: getNextNodeId(ctx.flow, node.id),
    halt: false,
    wait: false,
    variables: { contact_phone: phone },
    output: phone,
  };
}
