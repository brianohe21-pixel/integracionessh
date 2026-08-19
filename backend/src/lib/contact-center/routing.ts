import type { Bot, ContactCenterIvrFlow, IvrNode, IvrNodeType } from "../../types/index.js";

export function resolveBotRoutingMode(bot: Pick<Bot, "telephonyRoutingMode">): "ai" | "ivr" | "queue" {
  if (bot.telephonyRoutingMode === "ivr" || bot.telephonyRoutingMode === "queue") {
    return bot.telephonyRoutingMode;
  }
  return "ai";
}

export function findIvrNode(flow: ContactCenterIvrFlow, nodeId?: string): IvrNode | undefined {
  const id = nodeId || flow.entryNodeId;
  return flow.nodes.find((node) => node.nodeId === id);
}

export function resolveIvrDigit(
  node: IvrNode,
  digits: string
): { targetType: IvrNodeType; targetId?: string } | null {
  const option = (node.options ?? []).find((item) => item.digit === digits);
  if (!option) return null;
  return { targetType: option.targetType, ...(option.targetId ? { targetId: option.targetId } : {}) };
}

export function gatherDigitsForNode(node: IvrNode): string {
  const digits = (node.options ?? []).map((option) => option.digit).join("");
  return digits || "1234567890*#";
}
