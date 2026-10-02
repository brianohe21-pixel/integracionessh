import type { FlowNode } from "@/types";

export function resolveLegacyAssignBotId(nodes: FlowNode[]): string {
  const assignBotNode = nodes.find((node) => node.type === "assign_bot" && node.data.botId?.trim());
  return assignBotNode?.data.botId?.trim() ?? "";
}

export function resolveAgentBotId(nodes: FlowNode[]): string {
  const agentNode = nodes.find((node) => node.type === "agent" && node.data.botId?.trim());
  return agentNode?.data.botId?.trim() ?? "";
}

export function resolveFlowBotIdFromNodes(nodes: FlowNode[]): string {
  return resolveAgentBotId(nodes) || resolveLegacyAssignBotId(nodes);
}
