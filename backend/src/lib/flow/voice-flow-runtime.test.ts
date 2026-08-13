import { loadVoiceFlowRuntime } from "./voice-flow-runtime.js";

jest.mock("../dynamodb/bot.repository.js", () => ({
  getBot: jest.fn(async () => ({
    botId: "bot-1",
    tenantId: "tenant-1",
    telephonySystemPrompt: "Eres un asistente de taxis.",
    telephonyHandoffEnabled: false,
    knowledgeEnabled: true,
  })),
}));

jest.mock("../dynamodb/flow.repository.js", () => ({
  listFlowDefinitions: jest.fn(async () => []),
}));

jest.mock("../dynamodb/voice-agent-tool.repository.js", () => ({
  listVoiceAgentHttpTools: jest.fn(async () => [
    {
      tenantId: "tenant-1",
      botId: "bot-1",
      toolId: "tool-1",
      name: "lookup_customer",
      description: "Lookup",
      httpUrl: "https://api.example.com/customers",
      httpMethod: "GET",
      parametersJson: "{\"type\":\"object\",\"properties\":{}}",
      instruction: "Busca el cliente",
      enabled: true,
      sortOrder: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ]),
}));

jest.mock("../dynamodb/calendar-config.repository.js", () => ({
  getCalendarConfig: jest.fn(async () => null),
}));

jest.mock("../voicebot/realtime-config.js", () => ({
  buildVoicebotTools: jest.fn(() => [
    { type: "function", name: "search_knowledge", description: "Search" },
  ]),
}));

jest.mock("../voicebot/voice-agent-instructions.js", () => ({
  buildVoiceAgentRuntimeInstructions: jest.fn(async (params: {
    standaloneInstructionLines: string[];
  }) => `BASE\n${params.standaloneInstructionLines.join("\n")}`),
}));

describe("loadVoiceFlowRuntime", () => {
  it("returns standalone tools without visual flow", async () => {
    const runtime = await loadVoiceFlowRuntime({
      tenantId: "tenant-1",
      botId: "bot-1",
      locale: "es",
    });

    expect(runtime).not.toBeNull();
    expect(runtime?.standaloneToolByName.lookup_customer).toBe("tool-1");
    expect(runtime?.tools.some((tool) => tool.name === "lookup_customer")).toBe(true);
    expect(runtime?.instructions).toContain("lookup_customer");
  });
});
