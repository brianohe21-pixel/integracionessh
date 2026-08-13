import { validateVoiceAgentHttpToolInput } from "./voice-agent-tool.service.js";

jest.mock("../dynamodb/voice-agent-tool.repository.js", () => ({
  listVoiceAgentHttpTools: jest.fn(async () => []),
}));

jest.mock("../dynamodb/flow.repository.js", () => ({
  listFlowDefinitions: jest.fn(async () => []),
}));

jest.mock("./voice-agent-tool-secrets.repository.js", () => ({
  listVoiceAgentToolSecretNames: jest.fn(async () => ["API_KEY"]),
}));

describe("validateVoiceAgentHttpToolInput", () => {
  it("rejects reserved tool names", async () => {
    const issues = await validateVoiceAgentHttpToolInput({
      tenantId: "tenant-1",
      botId: "bot-1",
      environment: "dev",
      input: {
        name: "transfer_to_human",
        description: "Transfer",
        httpUrl: "https://api.example.com/handoff",
        httpMethod: "POST",
      },
    });
    expect(issues.some((issue) => issue.code === "reserved_tool_name")).toBe(true);
  });

  it("flags missing secrets", async () => {
    const issues = await validateVoiceAgentHttpToolInput({
      tenantId: "tenant-1",
      botId: "bot-1",
      environment: "dev",
      input: {
        name: "lookup_customer",
        description: "Lookup",
        httpUrl: "https://api.example.com?q={{secret.MISSING}}",
        httpMethod: "GET",
      },
    });
    expect(issues.some((issue) => issue.code === "missing_tool_secret")).toBe(true);
  });
});
