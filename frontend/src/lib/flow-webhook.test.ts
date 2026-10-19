import {
  coerceMessageEntryToWebhookTrigger,
  hasWebhookNode,
} from "./flow-webhook";
import type { FlowNode } from "@/types";

function node(
  type: FlowNode["type"],
  data: FlowNode["data"] = {},
  id = `${type}-1`
): FlowNode {
  return { id, type, position: { x: 0, y: 0 }, data };
}

describe("coerceMessageEntryToWebhookTrigger", () => {
  it("leaves messaging flows untouched", () => {
    const nodes = [
      node("message_received_trigger", {
        channel: "whatsapp",
        botId: "bot-1",
      }),
    ];
    expect(coerceMessageEntryToWebhookTrigger(nodes, "Inicio")).toBe(nodes);
  });

  it("converts message entry to generic start when webhook exists", () => {
    const nodes = [
      node("message_received_trigger", {
        label: "Inicio por mensaje",
        channel: "whatsapp",
        whatsappChannelIds: ["ch-1"],
        keywords: ["hola"],
        botId: "bot-1",
      }),
      node("webhook", { label: "Webhook" }),
    ];
    const next = coerceMessageEntryToWebhookTrigger(nodes, "Inicio");
    expect(hasWebhookNode(next)).toBe(true);
    expect(next[0]).toMatchObject({
      type: "trigger",
      data: {
        label: "Inicio",
        triggerType: "web_form_submitted",
        botId: "bot-1",
        channel: undefined,
        whatsappChannelIds: undefined,
        keywords: undefined,
      },
    });
  });
});
