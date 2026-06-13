import { sendInteractiveButtons } from "../../whatsapp/flows.js";
import type { FlowNode, FlowRun } from "../../../types/index.js";
import type { FlowExecutionContext, NodeExecutionResult } from "../types.js";
import { skipWhatsAppOnlyNode } from "./channel-guard.js";

export async function executeButtonsNode(
  node: FlowNode,
  ctx: FlowExecutionContext,
  _run: FlowRun
): Promise<NodeExecutionResult> {
  const skipped = skipWhatsAppOnlyNode(ctx, node.id, "buttons");
  if (skipped) return skipped;
  const buttons = node.data.buttons ?? [];
  const bodyText = node.data.messageText ?? "Choose an option:";

  if (ctx.buttonReplyId) {
    const { getNextNodeId } = await import("../graph.js");
    return {
      nextNodeId: getNextNodeId(ctx.flow, node.id, ctx.buttonReplyId),
      halt: false,
      wait: false,
      output: ctx.buttonReplyId,
    };
  }

  await sendInteractiveButtons({
    phoneNumberId: ctx.phoneNumberId,
    to: ctx.customerPhone,
    accessToken: ctx.accessToken,
    bodyText,
    buttons,
    ...(ctx.replyToMessageId ? { replyToMessageId: ctx.replyToMessageId } : {}),
  });

  return {
    nextNodeId: null,
    halt: true,
    wait: true,
    output: "awaiting_button",
  };
}
