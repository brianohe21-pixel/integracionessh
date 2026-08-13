import { assertSafeUrl } from "../webhook/client.js";
import {
  buildDemoToolResponse,
  isDemoModeEnabled,
  shouldUseDemoFallback,
} from "./voice-http-demo-fallback.js";
import { getFlowSecrets } from "./flow-secrets.repository.js";
import type { FlowNode } from "../../types/index.js";

const HTTP_TIMEOUT_MS = 20_000;
const MAX_RESPONSE_CHARS = 4_000;

function parseJsonBody(raw: string): unknown {
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

function resolveTemplate(
  template: string,
  context: Record<string, unknown>,
  secrets: Record<string, string>
): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_match, rawPath: string) => {
    const path = rawPath.trim();
    if (path.startsWith("secret.")) {
      const key = path.slice("secret.".length);
      return secrets[key] ?? "";
    }
    const value = path.split(".").reduce<unknown>((current, part) => {
      if (current && typeof current === "object" && part in (current as Record<string, unknown>)) {
        return (current as Record<string, unknown>)[part];
      }
      return undefined;
    }, context);
    if (value === undefined || value === null) return "";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  });
}

function resolveJsonBody(template: string, context: Record<string, unknown>, secrets: Record<string, string>): string {
  const resolved = resolveTemplate(template, context, secrets);
  const parsed = parseJsonBody(resolved);
  if (typeof parsed === "string") return parsed;
  return JSON.stringify(parsed);
}

export async function executeVoiceHttpNode(params: {
  node: FlowNode;
  args: Record<string, unknown>;
  variables: Record<string, string>;
  tenantId: string;
  environment: string;
  flowId: string;
}): Promise<{ output: string; variables: Record<string, string> }> {
  const urlTemplate = params.node.data.httpUrl?.trim();
  if (!urlTemplate) {
    return {
      output: JSON.stringify({ error: "httpUrl is required" }),
      variables: params.variables,
    };
  }

  const secrets = await getFlowSecrets(params.tenantId, params.environment, params.flowId);
  const context: Record<string, unknown> = {
    args: params.args,
    var: params.variables,
  };
  const resolvedUrl = resolveTemplate(urlTemplate, context, secrets);
  await assertSafeUrl(resolvedUrl);

  const method = params.node.data.httpMethod ?? "GET";
  const headers: Record<string, string> = {};
  for (const header of params.node.data.httpHeaders ?? []) {
    if (!header.key?.trim()) continue;
    headers[header.key.trim()] = resolveTemplate(header.value ?? "", context, secrets);
  }

  const init: RequestInit = {
    method,
    headers,
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  };

  if (method !== "GET" && params.node.data.httpBody) {
    if (!headers["Content-Type"] && !headers["content-type"]) {
      headers["Content-Type"] = "application/json";
    }
    init.body = resolveJsonBody(params.node.data.httpBody, context, secrets);
  }

  const toolName = params.node.data.voiceToolName?.trim() ?? "";
  const demoMode = isDemoModeEnabled(params.variables);

  const response = await fetch(resolvedUrl, init);
  const text = (await response.text()).slice(0, MAX_RESPONSE_CHARS);
  const parsedBody = parseJsonBody(text);

  if (demoMode && toolName && shouldUseDemoFallback(demoMode, response.ok, parsedBody, toolName)) {
    const demoBody = buildDemoToolResponse(toolName, params.args, params.variables);
    const demoText = JSON.stringify(demoBody);
    const output = JSON.stringify({
      ok: true,
      status: 200,
      demo: true,
      body: demoBody,
    });
    const variables = { ...params.variables };
    const responseVariable = params.node.data.httpResponseVariable?.trim();
    if (responseVariable) {
      variables[responseVariable] = demoText;
    }
    return { output, variables };
  }

  const output = JSON.stringify({
    ok: response.ok,
    status: response.status,
    body: parsedBody,
  });

  const variables = { ...params.variables };
  const responseVariable = params.node.data.httpResponseVariable?.trim();
  if (responseVariable) {
    variables[responseVariable] = text.slice(0, MAX_RESPONSE_CHARS);
  }

  return { output, variables };
}
