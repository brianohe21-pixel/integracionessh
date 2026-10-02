import type { FlowDefinition, FlowNode } from "../../types/index.js";

export function resolveLegacyAssignBotId(nodes: FlowNode[]): string | undefined {
  const assignBotNode = nodes.find((node) => node.type === "assign_bot" && node.data.botId?.trim());
  return assignBotNode?.data.botId?.trim();
}

export function resolveAgentBotId(nodes: FlowNode[]): string | undefined {
  const agentNode = nodes.find((node) => node.type === "agent" && node.data.botId?.trim());
  return agentNode?.data.botId?.trim();
}

export function resolveFlowBotIdFromNodes(nodes: FlowNode[]): string | undefined {
  return resolveAgentBotId(nodes) ?? resolveLegacyAssignBotId(nodes);
}

export function resolveFlowBotId(flow: FlowDefinition): string | undefined {
  const nodes = flow.draftNodes ?? flow.nodes;
  return resolveFlowBotIdFromNodes(nodes) ?? (flow.botId?.trim() || undefined);
}

export function withBotFromNodes<T extends FlowDefinition>(flow: T): T {
  const nodes = flow.draftNodes ?? flow.nodes;
  const botId = resolveFlowBotIdFromNodes(nodes) ?? flow.botId?.trim();
  if (botId) return { ...flow, botId };
  const next = { ...flow };
  delete next.botId;
  return next;
}
