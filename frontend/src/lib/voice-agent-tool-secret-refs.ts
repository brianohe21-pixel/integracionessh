import type { VoiceAgentHttpTool } from "@/types";

export function extractVoiceAgentToolSecretRefs(tool: Partial<VoiceAgentHttpTool>): string[] {
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

export function buildVoiceAgentToolPromptSnippet(tool: VoiceAgentHttpTool): string {
  if (tool.instruction?.trim()) {
    return `${tool.instruction.trim()} Usa la herramienta ${tool.name}.`;
  }
  return `Usa la herramienta ${tool.name} cuando sea necesario.`;
}

export const DEFAULT_VOICE_TOOL_PARAMETERS = JSON.stringify({
  type: "object",
  properties: {},
});
