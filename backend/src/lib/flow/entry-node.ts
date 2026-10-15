import type { FlowNode, FlowNodeType } from "../../types/index.js";

const ENTRY_NODE_TYPES = new Set<FlowNodeType>([
  "trigger",
  "message_received_trigger",
  "opportunity_stage_trigger",
]);

export function isFlowEntryNodeType(type: FlowNodeType): boolean {
  return ENTRY_NODE_TYPES.has(type);
}

export function isFlowEntryNode(node: FlowNode): boolean {
  return isFlowEntryNodeType(node.type);
}

export function getFlowEntryNode(nodes: FlowNode[]): FlowNode | undefined {
  return nodes.find(isFlowEntryNode);
}

export function countFlowEntryNodes(nodes: FlowNode[]): number {
  return nodes.filter(isFlowEntryNode).length;
}
