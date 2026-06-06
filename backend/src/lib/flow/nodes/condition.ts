import type { FlowNode, FlowRun } from "../../../types/index.js";
import type { FlowExecutionContext, NodeExecutionResult } from "../types.js";
import { getNextNodeId } from "../graph.js";

export async function executeConditionNode(
  node: FlowNode,
  ctx: FlowExecutionContext,
  run: FlowRun
): Promise<NodeExecutionResult> {
  const variable = node.data.conditionVariable ?? "last_input";
  const operator = node.data.conditionOperator ?? "contains";
  const expected = node.data.conditionValue ?? "";
  const source =
    variable === "last_input" ? ctx.inbound.text : (run.variables[variable] ?? "");

  let match = false;
  if (operator === "contains") {
    match = source.toLowerCase().includes(expected.toLowerCase());
  } else if (operator === "equals") {
    match = source.toLowerCase() === expected.toLowerCase();
  } else if (operator === "not_equals") {
    match = source.toLowerCase() !== expected.toLowerCase();
  }

  const handle = match ? "true" : "false";
  return {
    nextNodeId: getNextNodeId(ctx.flow, node.id, handle),
    halt: false,
    wait: false,
    output: match ? "true" : "false",
  };
}
