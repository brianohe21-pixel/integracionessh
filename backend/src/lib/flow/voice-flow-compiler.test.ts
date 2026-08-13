import { compileVoiceFlow, isVoiceAiFlow } from "./voice-flow-compiler.js";
import { buildTaxi355SatelitalVoiceFlow } from "./voice-flow-template.js";

describe("compileVoiceFlow", () => {
  it("compiles taxi template with tools and instructions", () => {
    const flow = buildTaxi355SatelitalVoiceFlow({
      flowId: "flow-1",
      tenantId: "tenant-1",
      botId: "bot-1",
      companyId: "company-123",
    });

    expect(isVoiceAiFlow(flow)).toBe(true);
    const compiled = compileVoiceFlow(flow, "es");
    expect(compiled).not.toBeNull();
    expect(compiled?.tools.length).toBeGreaterThan(4);
    expect(compiled?.openAiTools.some((tool) => tool.name === "autocomplete_street")).toBe(true);
    expect(compiled?.openAiTools.some((tool) => tool.name === "lookup_customer")).toBe(false);
    expect(compiled?.variables.company_id).toBe("company-123");
    expect(compiled?.instructions).toContain("355 Satelital");
    expect(compiled?.instructions).toContain("no menciones la ciudad ni el país");
    expect(compiled?.instructions).toContain("No pidas teléfono");
    expect(compiled?.instructions).toContain("Acepta las direcciones");
    expect(compiled?.toolNodeByName.autocomplete_street).toBe("http-autocomplete");
  });

  it("returns null for messaging flows", () => {
    const flow = buildTaxi355SatelitalVoiceFlow({
      flowId: "flow-1",
      tenantId: "tenant-1",
      botId: "bot-1",
      companyId: "company-123",
    });
    flow.nodes = flow.nodes.map((node) =>
      node.type === "trigger"
        ? { ...node, data: { ...node.data, triggerType: "any_message" as const } }
        : node
    );
    delete (flow as { flowKind?: string }).flowKind;
    expect(compileVoiceFlow(flow, "es")).toBeNull();
  });
});
