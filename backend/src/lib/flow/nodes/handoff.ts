import { performHandoff } from "../../advisor/handoff.js";
import type { FlowNode, FlowRun } from "../../../types/index.js";
import type { FlowExecutionContext, NodeExecutionResult } from "../types.js";

export async function executeHandoffNode(
  node: FlowNode,
  ctx: FlowExecutionContext,
  _run: FlowRun
): Promise<NodeExecutionResult> {
  await performHandoff({
    tenantId: ctx.tenantId,
    botId: ctx.botId,
    conversationId: ctx.conversation.conversationId,
    reason: "ai",
  });
  return {
    nextNodeId: null,
    halt: node.data.haltPipeline !== false,
    wait: false,
    output: "handoff",
  };
}
