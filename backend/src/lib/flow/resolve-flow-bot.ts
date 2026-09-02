import type { FlowDefinition, FlowNode } from "../../types/index.js";

export function resolveFlowBotIdFromNodes(nodes: FlowNode[]): string | undefined {
  const assignBotNode = nodes.find((node) => node.type === "assign_bot" && node.data.botId?.trim());
  return assignBotNode?.data.botId?.trim();
}

export function resolveFlowBotId(flow: FlowDefinition): string | undefined {
  return flow.botId ?? resolveFlowBotIdFromNodes(flow.nodes);
}

export function withBotFromNodes<T extends FlowDefinition>(flow: T): T {
  const botId = resolveFlowBotIdFromNodes(flow.nodes);
  if (botId) return { ...flow, botId };
  const next = { ...flow };
  delete next.botId;
  return next;
}
