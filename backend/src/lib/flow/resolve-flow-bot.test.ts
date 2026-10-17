import { resolveFlowBotIdFromNodes } from "./resolve-flow-bot.js";
import type { FlowNode } from "../../types/index.js";

function node(type: FlowNode["type"], data: FlowNode["data"] = {}): FlowNode {
  return { id: `${type}-1`, type, position: { x: 0, y: 0 }, data };
}

describe("resolveFlowBotIdFromNodes", () => {
  it("resolves botId from message_received_trigger", () => {
    expect(
      resolveFlowBotIdFromNodes([node("message_received_trigger", { botId: "bot-trigger" })])
    ).toBe("bot-trigger");
  });

  it("prefers agent botId over entry botId", () => {
    expect(
      resolveFlowBotIdFromNodes([
        node("message_received_trigger", { botId: "bot-trigger" }),
        node("agent", { botId: "bot-agent" }),
      ])
    ).toBe("bot-agent");
  });
});
