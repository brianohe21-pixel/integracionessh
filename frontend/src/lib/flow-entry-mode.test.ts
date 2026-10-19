import {
  applyFlowEntryMode,
  resolveFlowEntryMode,
} from "./flow-entry-mode";
import type { FlowEdge, FlowNode } from "@/types";

function node(
  type: FlowNode["type"],
  data: FlowNode["data"] = {},
  id = `${type}-1`
): FlowNode {
  return { id, type, position: { x: 0, y: 0 }, data };
}

const labels = {
  start: "Inicio",
  message: "Mensaje",
  stage: "Etapa",
  webhook: "Webhook",
};

describe("resolveFlowEntryMode", () => {
  it("detects message mode", () => {
    expect(
      resolveFlowEntryMode([
        node("message_received_trigger", { channel: "whatsapp" }),
      ])
    ).toBe("message");
  });

  it("detects webhook mode from webhook node", () => {
    expect(
      resolveFlowEntryMode([
        node("trigger", { triggerType: "web_form_submitted" }),
        node("webhook"),
      ])
    ).toBe("webhook");
  });

  it("detects stage mode", () => {
    expect(
      resolveFlowEntryMode([node("opportunity_stage_trigger")])
    ).toBe("stage");
  });
});

describe("applyFlowEntryMode", () => {
  it("switches message to webhook and inserts webhook node", () => {
    const nodes = [
      node("message_received_trigger", { channel: "whatsapp", botId: "bot-1" }),
      node("message", { label: "Hi" }, "message-1"),
    ];
    const edges: FlowEdge[] = [
      { id: "e1", source: "message_received_trigger-1", target: "message-1" },
    ];
    const next = applyFlowEntryMode({
      nodes,
      edges,
      mode: "webhook",
      labels,
    });
    expect(resolveFlowEntryMode(next.nodes)).toBe("webhook");
    expect(next.nodes.some((item) => item.type === "webhook")).toBe(true);
    expect(next.nodes[0]).toMatchObject({
      type: "trigger",
      data: { triggerType: "web_form_submitted", botId: "bot-1" },
    });
  });

  it("switches webhook back to message and removes webhook node", () => {
    const nodes = [
      node("trigger", { triggerType: "web_form_submitted" }, "entry-1"),
      node("webhook", {}, "webhook-1"),
      node("message", {}, "message-1"),
    ];
    const edges: FlowEdge[] = [
      { id: "e1", source: "entry-1", target: "webhook-1" },
      { id: "e2", source: "webhook-1", target: "message-1" },
    ];
    const next = applyFlowEntryMode({
      nodes,
      edges,
      mode: "message",
      labels,
    });
    expect(resolveFlowEntryMode(next.nodes)).toBe("message");
    expect(next.nodes.some((item) => item.type === "webhook")).toBe(false);
    expect(
      next.edges.some(
        (edge) => edge.source === "entry-1" && edge.target === "message-1"
      )
    ).toBe(true);
  });
});
