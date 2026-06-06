import { sendTextMessage } from "../../whatsapp/client.js";
import type { FlowNode, FlowRun } from "../../../types/index.js";
import type { FlowExecutionContext, NodeExecutionResult } from "../types.js";
import { getNextNodeId } from "../graph.js";

export async function executeMessageNode(
  node: FlowNode,
  ctx: FlowExecutionContext,
  _run: FlowRun
): Promise<NodeExecutionResult> {
  const text = node.data.messageText ?? "";
  if (text) {
    await sendTextMessage({
      phoneNumberId: ctx.phoneNumberId,
      to: ctx.customerPhone,
      text,
      accessToken: ctx.accessToken,
      ...(ctx.replyToMessageId ? { replyToMessageId: ctx.replyToMessageId } : {}),
    });
  }
  return {
    nextNodeId: getNextNodeId(ctx.flow, node.id),
    halt: false,
    wait: false,
    output: text,
  };
}
