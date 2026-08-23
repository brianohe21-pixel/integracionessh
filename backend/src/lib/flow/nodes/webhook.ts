import type { FlowNode, FlowRun } from "../../../types/index.js";
import type { FlowExecutionContext, NodeExecutionResult } from "../types.js";
import { getNextNodeId } from "../graph.js";

export async function executeWebhookNode(
  node: FlowNode,
  ctx: FlowExecutionContext,
  _run: FlowRun
): Promise<NodeExecutionResult> {
  return {
    nextNodeId: getNextNodeId(ctx.flow, node.id),
    halt: false,
    wait: false,
  };
}
