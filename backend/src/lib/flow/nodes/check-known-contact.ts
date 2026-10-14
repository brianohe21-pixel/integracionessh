import type { FlowNode, FlowRun } from "../../../types/index.js";
import { resolveIsKnownContact } from "../../contacts/is-known-contact.js";
import {
  buildBindingContext,
  conversationBindingFromContext,
  resolveBindingValue,
  resolveContactIdentity,
} from "../binding.js";
import { getNextNodeId } from "../graph.js";
import type { FlowExecutionContext, NodeExecutionResult } from "../types.js";

export async function executeCheckKnownContactNode(
  node: FlowNode,
  ctx: FlowExecutionContext,
  run: FlowRun
): Promise<NodeExecutionResult> {
  const bindingContext = buildBindingContext({
    formPayload: ctx.formPayload,
    variables: run.variables,
    conversation: conversationBindingFromContext(ctx),
  });

  const boundPhone = resolveContactIdentity(
    resolveBindingValue(node.data.contactPhoneBinding, bindingContext)
  );
  const phoneCandidate =
    boundPhone || run.variables.contact_phone || run.variables.phone || ctx.customerPhone || null;

  const { isKnown, phone } = await resolveIsKnownContact({
    tenantId: ctx.tenantId,
    phone: phoneCandidate,
    conversation: ctx.conversation ?? null,
    participantId: ctx.customerPhone ?? null,
  });

  const handle = isKnown ? "true" : "false";

  return {
    nextNodeId: getNextNodeId(ctx.flow, node.id, handle),
    halt: false,
    wait: false,
    variables: {
      is_known_contact: isKnown ? "true" : "false",
      ...(phone ? { contact_phone: phone, phone } : {}),
    },
    output: handle,
  };
}
