import type { FlowNode, FlowRun } from "../../../types/index.js";
import type { FlowExecutionContext, NodeExecutionResult } from "../types.js";
import { getNextNodeId } from "../graph.js";

export async function executeDelayNode(
  node: FlowNode,
  ctx: FlowExecutionContext,
  _run: FlowRun
): Promise<NodeExecutionResult> {
  const seconds = Math.min(Math.max(node.data.delaySeconds ?? 5, 1), 86400);
  const waitingUntil = new Date(Date.now() + seconds * 1000).toISOString();
  const next = getNextNodeId(ctx.flow, node.id);
  return {
    nextNodeId: next,
    halt: true,
    wait: true,
    waitingUntil,
    output: `delay_${seconds}s`,
  };
}
