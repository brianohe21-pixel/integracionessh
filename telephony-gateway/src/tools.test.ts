import { buildRealtimeTools, parseToolExecutionResult } from "./tools.js";

describe("telephony gateway tools", () => {
  it("includes knowledge and calendar tools when enabled", () => {
    const tools = buildRealtimeTools({
      locale: "es",
      knowledgeEnabled: true,
      calendarEnabled: true,
      handoffEnabled: true,
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
    expect(names).toEqual([]);
  });

  it("omits handoff tool when disabled", () => {
    const tools = buildRealtimeTools({
      locale: "es",
      knowledgeEnabled: false,
      calendarEnabled: false,
      handoffEnabled: false,
    });
    expect(tools).toEqual([]);
  });

  it("parses successful and failed tool outputs", () => {
    expect(parseToolExecutionResult(JSON.stringify({ ok: true, status: 200 }))).toEqual({
      success: true,
      statusCode: 200,
    });
    expect(parseToolExecutionResult(JSON.stringify({ ok: false, status: 500 }))).toEqual({
      success: false,
      statusCode: 500,
    });
    expect(parseToolExecutionResult(JSON.stringify({ error: "timeout" }))).toEqual({
      success: false,
      error: "timeout",
    });
  });
});
