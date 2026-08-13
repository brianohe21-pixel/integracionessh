import type { FlowNode, VoiceAgentHttpTool } from "../../types/index.js";

export const RESERVED_VOICE_TOOL_NAMES = new Set([
  "transfer_to_human",
  "search_knowledge",
  "list_available_slots",
  "create_booking",
  "cancel_booking",
]);

export const VOICE_TOOL_NAME_PATTERN = /^[a-z][a-z0-9_]{2,63}$/;

export function parseVoiceToolParameters(raw?: string): Record<string, unknown> {
  if (!raw?.trim()) {
    return { type: "object", properties: {} };
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed.type === "object") return parsed;
    return { type: "object", properties: parsed };
  } catch {
    return { type: "object", properties: {} };
  }
}

export function extractVoiceAgentToolSecretRefs(tool: VoiceAgentHttpTool): string[] {
  const refs = new Set<string>();
  const pattern = /\{\{secret\.([^}]+)\}\}/g;
  const parts = [
    tool.httpUrl ?? "",
    tool.httpBody ?? "",
    ...(tool.httpHeaders ?? []).flatMap((header) => [header.key, header.value]),
  ];
  for (const part of parts) {
    let match: RegExpExecArray | null;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(part)) !== null) {
      refs.add(match[1].trim());
    }
  }
  return [...refs].sort();
}

export function compileVoiceAgentHttpTools(tools: VoiceAgentHttpTool[]): {
  openAiTools: Array<Record<string, unknown>>;
  toolByName: Record<string, string>;
  instructionLines: string[];
} {
  const enabledTools = tools.filter((tool) => tool.enabled);
  const toolByName: Record<string, string> = {};
  const instructionLines: string[] = [];

  for (const tool of enabledTools) {
    toolByName[tool.name] = tool.toolId;
    if (tool.instruction?.trim()) {
      instructionLines.push(`- ${tool.instruction.trim()} Usa la herramienta ${tool.name}.`);
    }
  }

  const openAiTools = enabledTools.map((tool) => ({
    type: "function",
    name: tool.name,
    description: tool.description.trim() || tool.name,
    parameters: parseVoiceToolParameters(tool.parametersJson),
  }));

  return { openAiTools, toolByName, instructionLines };
}

export function voiceAgentToolToFlowNode(tool: VoiceAgentHttpTool): FlowNode {
  return {
    id: tool.toolId,
    type: "http_request",
    position: { x: 0, y: 0 },
    data: {
      httpUrl: tool.httpUrl,
      httpMethod: tool.httpMethod,
      voiceToolName: tool.name,
      voiceToolDescription: tool.description,
      voiceToolParameters: tool.parametersJson,
      ...(tool.httpBody !== undefined ? { httpBody: tool.httpBody } : {}),
      ...(tool.httpHeaders !== undefined ? { httpHeaders: tool.httpHeaders } : {}),
      ...(tool.httpResponseVariable !== undefined
        ? { httpResponseVariable: tool.httpResponseVariable }
        : {}),
      ...(tool.instruction !== undefined ? { voiceInstruction: tool.instruction } : {}),
    },
  };
}
