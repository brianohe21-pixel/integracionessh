import {
  compileVoiceAgentHttpTools,
  extractVoiceAgentToolSecretRefs,
  parseVoiceToolParameters,
  RESERVED_VOICE_TOOL_NAMES,
} from "./voice-agent-tool-compiler.js";
import type { VoiceAgentHttpTool } from "../../types/index.js";

function sampleTool(overrides: Partial<VoiceAgentHttpTool> = {}): VoiceAgentHttpTool {
  return {
    tenantId: "tenant-1",
    botId: "bot-1",
    toolId: "tool-1",
    name: "lookup_customer",
    description: "Find customer by phone",
    httpUrl: "https://api.example.com/customers?phone={{args.phone}}",
    httpMethod: "GET",
    httpHeaders: [{ key: "X-Api-Key", value: "{{secret.API_KEY}}" }],
    parametersJson: JSON.stringify({
      type: "object",
      properties: { phone: { type: "string" } },
    }),
    instruction: "Busca el cliente por teléfono",
    enabled: true,
    sortOrder: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("voice-agent-tool-compiler", () => {
  it("parses tool parameters json", () => {
    const parsed = parseVoiceToolParameters(
      JSON.stringify({ phone: { type: "string" } })
    );
    expect(parsed.type).toBe("object");
    expect(parsed.properties).toEqual({ phone: { type: "string" } });
  });

  it("compiles enabled tools to OpenAI format", () => {
    const compiled = compileVoiceAgentHttpTools([
      sampleTool(),
      sampleTool({ toolId: "tool-2", name: "disabled_tool", enabled: false }),
    ]);
    expect(compiled.openAiTools).toHaveLength(1);
    expect(String(compiled.openAiTools[0]?.name ?? "")).toBe("lookup_customer");
    expect(compiled.toolByName.lookup_customer).toBe("tool-1");
    expect(compiled.instructionLines[0]).toContain("lookup_customer");
  });

  it("extracts secret references", () => {
    const refs = extractVoiceAgentToolSecretRefs(sampleTool());
    expect(refs).toEqual(["API_KEY"]);
  });

  it("lists reserved tool names", () => {
    expect(RESERVED_VOICE_TOOL_NAMES.has("transfer_to_human")).toBe(true);
  });
});
