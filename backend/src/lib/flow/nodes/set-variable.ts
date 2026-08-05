import type { FlowNode, FlowRun } from "../../../types/index.js";
import type { FlowExecutionContext, NodeExecutionResult } from "../types.js";
import { buildBindingContext, resolveBindingValue } from "../binding.js";
import { getNextNodeId } from "../graph.js";

export async function executeSetVariableNode(
  node: FlowNode,
  ctx: FlowExecutionContext,
  run: FlowRun
): Promise<NodeExecutionResult> {
  const name = node.data.variableName;
  if (!name) throw new Error("variableName required");
  const bindingContext = buildBindingContext({
    formPayload: ctx.formPayload,
    variables: run.variables,
  });
  let value = node.data.variableValue ?? "";
  if (value === "$last_input") {
    value = ctx.inbound?.text ?? "";
  } else if (value.includes("{{")) {
    value = resolveBindingValue(value, bindingContext);
  }
  return {
    nextNodeId: getNextNodeId(ctx.flow, node.id),
    halt: false,
    wait: false,
    variables: { [name]: value },
    output: value,
  };
}
