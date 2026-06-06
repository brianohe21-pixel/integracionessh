import type { FlowNode, FlowRun } from "../../../types/index.js";
import type { FlowExecutionContext, NodeExecutionResult } from "../types.js";
import { getNextNodeId } from "../graph.js";

export async function executeSetVariableNode(
  node: FlowNode,
  ctx: FlowExecutionContext,
  _run: FlowRun
): Promise<NodeExecutionResult> {
  const name = node.data.variableName;
  if (!name) throw new Error("variableName required");
  let value = node.data.variableValue ?? "";
  if (value === "$last_input") {
    value = ctx.inbound.text;
  }
  return {
    nextNodeId: getNextNodeId(ctx.flow, node.id),
    halt: false,
    wait: false,
    variables: { [name]: value },
    output: value,
  };
}
