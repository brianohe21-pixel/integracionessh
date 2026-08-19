import { z } from "zod";
import {
  listVoiceAgentHttpTools,
  getVoiceAgentHttpTool,
} from "../dynamodb/voice-agent-tool.repository.js";
import { listFlowDefinitions } from "../dynamodb/flow.repository.js";
import { compileVoiceFlow, findVoiceFlowForBot } from "../flow/voice-flow-compiler.js";
import {
  extractVoiceAgentToolSecretRefs,
  RESERVED_VOICE_TOOL_NAMES,
  VOICE_TOOL_NAME_PATTERN,
  parseVoiceToolParameters,
} from "./voice-agent-tool-compiler.js";
import { listVoiceAgentToolSecretNames } from "./voice-agent-tool-secrets.repository.js";
import type { FlowHttpHeader, VoiceAgentHttpTool } from "../../types/index.js";

const HttpHeaderSchema = z.object({
  key: z.string().min(1).max(128),
  value: z.string().max(2048),
});

export const VoiceAgentHttpToolInputSchema = z.object({
  name: z.string().regex(VOICE_TOOL_NAME_PATTERN),
  description: z.string().min(1).max(500),
  httpUrl: z.string().min(8).max(2048),
  httpMethod: z.enum(["GET", "POST", "PATCH"]),
  httpBody: z.string().max(8000).optional(),
  httpHeaders: z.array(HttpHeaderSchema).max(20).optional(),
  httpResponseVariable: z
    .string()
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/)
    .max(64)
    .optional(),
  parametersJson: z.string().max(8000).optional(),
  instruction: z.string().max(1000).optional(),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(999999).optional(),
});

export interface VoiceAgentToolValidationIssue {
  code: string;
  message: string;
}

function validateParametersJson(raw?: string): VoiceAgentToolValidationIssue | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = parseVoiceToolParameters(raw);
    if (parsed.type !== "object") {
      return { code: "invalid_parameters_json", message: "parametersJson must be a JSON object schema" };
    }
    return null;
  } catch {
    return { code: "invalid_parameters_json", message: "parametersJson must be valid JSON" };
  }
}

async function collectFlowToolNames(
  tenantId: string,
  botId: string,
  preferredFlowId?: string
): Promise<Set<string>> {
  const flows = await listFlowDefinitions(tenantId, botId);
  const flow = findVoiceFlowForBot(flows, preferredFlowId);
  if (!flow) return new Set();
  const compiled = compileVoiceFlow(flow, "es");
  if (!compiled) return new Set();
  return new Set(compiled.tools.map((tool) => tool.name));
}

export async function validateVoiceAgentHttpToolInput(params: {
  tenantId: string;
  botId: string;
  input: z.infer<typeof VoiceAgentHttpToolInputSchema>;
  toolId?: string;
  preferredFlowId?: string;
  environment: string;
}): Promise<VoiceAgentToolValidationIssue[]> {
  const issues: VoiceAgentToolValidationIssue[] = [];
  const { input, tenantId, botId, toolId } = params;

  if (RESERVED_VOICE_TOOL_NAMES.has(input.name)) {
    issues.push({
      code: "reserved_tool_name",
      message: `Tool name ${input.name} is reserved`,
    });
  }

  if (!input.httpUrl.startsWith("https://")) {
    issues.push({
      code: "invalid_http_url",
      message: "httpUrl must use HTTPS",
    });
  }

  const parametersIssue = validateParametersJson(input.parametersJson);
  if (parametersIssue) issues.push(parametersIssue);

  const existingTools = await listVoiceAgentHttpTools(tenantId, botId);
  const duplicate = existingTools.find(
    (tool) => tool.name === input.name && tool.toolId !== toolId
  );
  if (duplicate) {
    issues.push({
      code: "duplicate_tool_name",
      message: `Duplicate tool name: ${input.name}`,
    });
  }

  const flowToolNames = await collectFlowToolNames(tenantId, botId, params.preferredFlowId);
  if (flowToolNames.has(input.name)) {
    issues.push({
      code: "duplicate_flow_tool_name",
      message: `Tool name conflicts with visual flow tool: ${input.name}`,
    });
  }

  const pseudoTool: VoiceAgentHttpTool = {
    tenantId,
    botId,
    toolId: toolId ?? "new",
    name: input.name,
    description: input.description,
    httpUrl: input.httpUrl,
    httpMethod: input.httpMethod,
    parametersJson: input.parametersJson ?? "",
    enabled: input.enabled ?? true,
    sortOrder: input.sortOrder ?? 0,
    createdAt: "",
    updatedAt: "",
    ...(input.httpBody !== undefined ? { httpBody: input.httpBody } : {}),
    ...(input.httpHeaders !== undefined
      ? { httpHeaders: input.httpHeaders as FlowHttpHeader[] }
      : {}),
    ...(input.httpResponseVariable !== undefined
      ? { httpResponseVariable: input.httpResponseVariable }
      : {}),
    ...(input.instruction !== undefined ? { instruction: input.instruction } : {}),
  };
  const secretRefs = extractVoiceAgentToolSecretRefs(pseudoTool);
  if (secretRefs.length > 0) {
    const configured = new Set(
      await listVoiceAgentToolSecretNames(tenantId, params.environment, botId)
    );
    for (const ref of secretRefs) {
      if (!configured.has(ref)) {
        issues.push({
          code: "missing_tool_secret",
          message: `Missing secret: ${ref}`,
        });
      }
    }
  }

  return issues;
}

export async function validateVoiceAgentHttpToolEnabled(params: {
  tenantId: string;
  botId: string;
  tool: VoiceAgentHttpTool;
  environment: string;
  preferredFlowId?: string;
}): Promise<VoiceAgentToolValidationIssue[]> {
  const issues = await validateVoiceAgentHttpToolInput({
    tenantId: params.tenantId,
    botId: params.botId,
    toolId: params.tool.toolId,
    environment: params.environment,
    ...(params.preferredFlowId ? { preferredFlowId: params.preferredFlowId } : {}),
    input: {
      name: params.tool.name,
      description: params.tool.description,
      httpUrl: params.tool.httpUrl,
      httpMethod: params.tool.httpMethod,
      parametersJson: params.tool.parametersJson,
      enabled: params.tool.enabled,
      sortOrder: params.tool.sortOrder,
      ...(params.tool.httpBody !== undefined ? { httpBody: params.tool.httpBody } : {}),
      ...(params.tool.httpHeaders !== undefined ? { httpHeaders: params.tool.httpHeaders } : {}),
      ...(params.tool.httpResponseVariable !== undefined
        ? { httpResponseVariable: params.tool.httpResponseVariable }
        : {}),
      ...(params.tool.instruction !== undefined ? { instruction: params.tool.instruction } : {}),
    },
  });
  return issues;
}

export function maskSensitiveValue(value: string, secrets: Record<string, string>): string {
  let masked = value;
  for (const secretValue of Object.values(secrets)) {
    if (!secretValue) continue;
    if (masked.includes(secretValue)) {
      masked = masked.split(secretValue).join("***");
    }
  }
  return masked;
}

export async function buildVoiceAgentToolTestResult(params: {
  tenantId: string;
  botId: string;
  toolId: string;
  args: Record<string, unknown>;
  variables?: Record<string, string>;
  environment: string;
}): Promise<{
  ok: boolean;
  status?: number;
  durationMs: number;
  resolvedUrl?: string;
  headers?: Record<string, string>;
  body?: unknown;
  variables?: Record<string, string>;
  error?: string;
}> {
  const tool = await getVoiceAgentHttpTool(params.tenantId, params.botId, params.toolId);
  if (!tool) {
    return { ok: false, durationMs: 0, error: "Tool not found" };
  }

  const { getVoiceAgentToolSecrets } = await import("./voice-agent-tool-secrets.repository.js");
  const { executeVoiceAgentHttpToolById } = await import("./voice-agent-tool-executor.js");
  const secrets = await getVoiceAgentToolSecrets(
    params.tenantId,
    params.environment,
    params.botId
  );

  const started = Date.now();
  const result = await executeVoiceAgentHttpToolById({
    tenantId: params.tenantId,
    botId: params.botId,
    toolId: params.toolId,
    args: params.args,
    environment: params.environment,
    ...(params.variables ? { variables: params.variables } : {}),
  });
  const durationMs = Date.now() - started;

  if (!result) {
    return { ok: false, durationMs, error: "Tool execution failed" };
  }

  const parsed = JSON.parse(result.output) as {
    ok?: boolean;
    status?: number;
    body?: unknown;
    error?: string;
  };

  const { voiceAgentToolToFlowNode } = await import("./voice-agent-tool-compiler.js");
  const node = voiceAgentToolToFlowNode(tool);
  const resolvedUrlTemplate = node.data.httpUrl ?? "";
  const resolvedHeaders: Record<string, string> = {};
  for (const header of node.data.httpHeaders ?? []) {
    if (!header.key?.trim()) continue;
    const value = header.value ?? "";
    resolvedHeaders[header.key.trim()] = maskSensitiveValue(value, secrets);
  }

  return {
    ok: Boolean(parsed.ok),
    durationMs,
    resolvedUrl: maskSensitiveValue(resolvedUrlTemplate, secrets),
    headers: resolvedHeaders,
    body: parsed.body,
    variables: result.variables,
    ...(parsed.status !== undefined ? { status: parsed.status } : {}),
    ...(parsed.error ? { error: parsed.error } : {}),
  };
}
