import type { FlowNode, FlowRun } from "../../../types/index.js";
import type { FlowExecutionContext, NodeExecutionResult } from "../types.js";
import { buildBindingContext, resolveBindingValue } from "../binding.js";
import { getNextNodeId } from "../graph.js";

export async function executeConditionNode(
  node: FlowNode,
  ctx: FlowExecutionContext,
  run: FlowRun
): Promise<NodeExecutionResult> {
  const variable = node.data.conditionVariable ?? "last_input";
  const operator = node.data.conditionOperator ?? "contains";
  const expected = node.data.conditionValue ?? "";
  const bindingContext = buildBindingContext({
    formPayload: ctx.formPayload,
    variables: run.variables,
  });

  let source = "";
  if (variable === "last_input") {
    source = ctx.inbound?.text ?? run.variables.last_input ?? "";
  } else if (variable.includes("{{")) {
    source = resolveBindingValue(variable, bindingContext);
  } else {
    source = run.variables[variable] ?? resolveBindingValue(`{{${variable}}}`, bindingContext);
  }

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
