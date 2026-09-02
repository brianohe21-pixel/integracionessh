import type { FlowNode } from "@/types";

export function resolveFlowBotIdFromNodes(nodes: FlowNode[]): string {
  const assignBotNode = nodes.find((node) => node.type === "assign_bot" && node.data.botId?.trim());
  return assignBotNode?.data.botId?.trim() ?? "";
}
