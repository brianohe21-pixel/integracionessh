import type { FlowNode, FlowRun } from "../../../types/index.js";
import type { FlowExecutionContext, NodeExecutionResult } from "../types.js";

export async function executeEndNode(
  node: FlowNode,
  _ctx: FlowExecutionContext,
  _run: FlowRun
): Promise<NodeExecutionResult> {
  return {
    nextNodeId: null,
    halt: node.data.haltPipeline !== false,
    wait: false,
    output: "end",
  };
}
