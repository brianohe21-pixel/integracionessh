import type { FlowDefinition } from "../../types/index.js";

export function getNextNodeId(
  flow: FlowDefinition,
  currentNodeId: string,
  sourceHandle?: string
): string | null {
  const edge = flow.edges.find(
    (e) =>
      e.source === currentNodeId &&
      (sourceHandle === undefined || e.sourceHandle === sourceHandle || !e.sourceHandle)
  );
  return edge?.target ?? null;
}

export function getOutgoingEdges(flow: FlowDefinition, nodeId: string) {
  return flow.edges.filter((e) => e.source === nodeId);
}
