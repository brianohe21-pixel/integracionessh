import { executeVoiceHttpNode } from "./voice-http-executor.js";
import type { FlowNode } from "../../types/index.js";

jest.mock("./flow-secrets.repository.js", () => ({
  getFlowSecrets: jest.fn(async () => ({ FYRAGO_API_KEY: "secret-value" })),
}));

jest.mock("../webhook/client.js", () => ({
  assertSafeUrl: jest.fn(async () => undefined),
}));

const fetchMock = jest.fn();
global.fetch = fetchMock as unknown as typeof fetch;

function httpNode(overrides: Partial<FlowNode["data"]> = {}): FlowNode {
  return {
    id: "http-1",
    type: "http_request",
    position: { x: 0, y: 0 },
    data: {
      httpUrl: "https://example.com/v1/customers?phone={{args.phone_number}}",
      httpMethod: "GET",
      httpHeaders: [{ key: "X-Api-Key", value: "{{secret.FYRAGO_API_KEY}}" }],
      ...overrides,
    },
  };
}

describe("executeVoiceHttpNode", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: "cust-1" }),
    });
  });

  it("resolves args, secrets and returns json output", async () => {
    const result = await executeVoiceHttpNode({
      node: httpNode(),
      args: { phone_number: "3001234567" },
      variables: { company_id: "c1" },
      tenantId: "tenant-1",
      environment: "dev",
      flowId: "flow-1",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/v1/customers?phone=3001234567",
      expect.objectContaining({
        method: "GET",
        headers: { "X-Api-Key": "secret-value" },
      })
    );
    expect(JSON.parse(result.output).ok).toBe(true);
  });

  it("stores response in configured variable", async () => {
    const result = await executeVoiceHttpNode({
      node: httpNode({ httpResponseVariable: "last_response" }),
      args: {},
      variables: {},
      tenantId: "tenant-1",
      environment: "dev",
      flowId: "flow-1",
    });
    expect(result.variables.last_response).toContain("cust-1");
  });

  it("returns demo payload when API fails in demo mode", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => JSON.stringify({ success: false, error: "company not found: 12345" }),
    });

    const result = await executeVoiceHttpNode({
      node: httpNode({
        voiceToolName: "create_offer",
        httpResponseVariable: "offer_response",
      }),
      args: { customer_id: "cust-1" },
      variables: { demo_mode: "true" },
      tenantId: "tenant-1",
      environment: "dev",
      flowId: "flow-1",
    });

    const parsed = JSON.parse(result.output) as { demo?: boolean; body?: { demo?: boolean } };
    expect(parsed.demo).toBe(true);
    expect(parsed.body?.demo).toBe(true);
    expect(result.variables.offer_response).toContain("demo-offer-001");
  });
});
