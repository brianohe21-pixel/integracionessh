import { buildRealtimeTools } from "./tools.js";

describe("telephony gateway tools", () => {
  it("includes knowledge and calendar tools when enabled", () => {
    const tools = buildRealtimeTools({
      locale: "es",
      knowledgeEnabled: true,
      calendarEnabled: true,
    });
    const names = tools.map((tool) => tool.name);
    expect(names).toContain("transfer_to_human");
    expect(names).toContain("search_knowledge");
    expect(names).toContain("list_available_slots");
  });

  it("omits optional tools when disabled", () => {
    const tools = buildRealtimeTools({
      locale: "en",
      knowledgeEnabled: false,
      calendarEnabled: false,
    });
    const names = tools.map((tool) => tool.name);
    expect(names).toEqual(["transfer_to_human"]);
  });
});
