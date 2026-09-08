import type { FlowDefinition, FlowEdge, FlowNode } from "../../types/index.js";

export function sanitizeEdgesForNodes(nodes: FlowNode[], edges: FlowEdge[]): FlowEdge[] {
  const nodeIds = new Set(nodes.map((node) => node.id));
  return edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));
}

export function sanitizeFlowEdges(flow: FlowDefinition): FlowDefinition {
  const edges = sanitizeEdgesForNodes(flow.nodes, flow.edges);
  const draftNodes = flow.draftNodes ?? flow.nodes;
  const draftEdges = flow.draftEdges ?? flow.edges;
  const sanitizedDraftEdges = sanitizeEdgesForNodes(draftNodes, draftEdges);
  const edgesChanged = edges.length !== flow.edges.length;
  const draftEdgesChanged =
    flow.draftEdges !== undefined && sanitizedDraftEdges.length !== flow.draftEdges.length;
  if (!edgesChanged && !draftEdgesChanged) return flow;
  return {
    ...flow,
    edges,
    ...(draftEdgesChanged ? { draftEdges: sanitizedDraftEdges } : {}),
  };
}

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
