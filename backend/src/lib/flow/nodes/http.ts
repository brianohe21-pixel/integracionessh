import type { FlowNode, FlowRun } from "../../../types/index.js";
import type { FlowExecutionContext, NodeExecutionResult } from "../types.js";
import { buildBindingContext, resolveBindingValue } from "../binding.js";
import { getNextNodeId } from "../graph.js";

export async function executeHttpRequestNode(
  node: FlowNode,
  ctx: FlowExecutionContext,
  run: FlowRun
): Promise<NodeExecutionResult> {
  const url = node.data.httpUrl;
  if (!url) throw new Error("httpUrl required");

  const bindingContext = buildBindingContext({
    formPayload: ctx.formPayload,
    variables: run.variables,
  });

  let body = node.data.httpBody ?? "";
  for (const [key, val] of Object.entries(run.variables)) {
    body = body.replaceAll(`{{${key}}}`, val);
  }
  body = resolveBindingValue(body, bindingContext);
  const resolvedUrl = resolveBindingValue(url, bindingContext);

  const method = node.data.httpMethod ?? "GET";
  const response = await fetch(resolvedUrl, {
    method,
    ...(method === "POST" ? { headers: { "Content-Type": "application/json" }, body } : {}),
  });
  const text = await response.text();

  return {
    nextNodeId: getNextNodeId(ctx.flow, node.id),
    halt: false,
    wait: false,
    variables: { http_response: text.slice(0, 2000) },
    output: text.slice(0, 500),
  };
}
