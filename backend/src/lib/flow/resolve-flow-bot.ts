import type { FlowDefinition, FlowNode } from "../../types/index.js";

export function resolveLegacyAssignBotId(nodes: FlowNode[]): string | undefined {
  const assignBotNode = nodes.find((node) => node.type === "assign_bot" && node.data.botId?.trim());
  return assignBotNode?.data.botId?.trim();
}

export function resolveFlowBotIdFromNodes(nodes: FlowNode[]): string | undefined {
  return resolveLegacyAssignBotId(nodes);
}

export function resolveFlowBotId(flow: FlowDefinition): string | undefined {
  return flow.botId ?? resolveLegacyAssignBotId(flow.nodes);
}

export function withBotFromNodes<T extends FlowDefinition>(flow: T): T {
  if (flow.botId?.trim()) return flow;
  const botId = resolveLegacyAssignBotId(flow.nodes);
  if (botId) return { ...flow, botId };
  const next = { ...flow };
  delete next.botId;
  return next;
}
