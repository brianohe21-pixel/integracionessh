import type { FlowNode, FlowRun } from "../../../types/index.js";
import type { FlowExecutionContext, NodeExecutionResult } from "../types.js";
import { buildBindingContext, resolveBindingValue } from "../binding.js";
import { getNextNodeId } from "../graph.js";
import { assertSafeUrl } from "../../webhook/client.js";

function resolveTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_match, rawPath: string) => {
    const path = rawPath.trim();
    if (path.startsWith("var.")) {
      return variables[path.slice("var.".length)] ?? "";
    }
    return variables[path] ?? "";
  });
}

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
  await assertSafeUrl(resolvedUrl);

  const method = node.data.httpMethod ?? "GET";
  const headers: Record<string, string> = {};
  for (const header of node.data.httpHeaders ?? []) {
    if (!header.key?.trim()) continue;
    headers[header.key.trim()] = resolveTemplate(
      resolveBindingValue(header.value ?? "", bindingContext),
      run.variables
    );
  }

  const init: RequestInit = { method, headers };
  if (method !== "GET" && body) {
    if (!headers["Content-Type"] && !headers["content-type"]) {
      headers["Content-Type"] = "application/json";
    }
    init.body = body;
  }

  const response = await fetch(resolvedUrl, init);
  const text = await response.text();
  const responseVariable = node.data.httpResponseVariable?.trim() || "http_response";

  return {
    nextNodeId: getNextNodeId(ctx.flow, node.id),
    halt: false,
    wait: false,
    variables: { [responseVariable]: text.slice(0, 2000) },
    output: text.slice(0, 500),
  };
}
