import type { FlowDefinition, FlowEdge, FlowNode } from "@/types";

export function resolveDraftNodes(flow: FlowDefinition): FlowNode[] {
  return flow.draftNodes ?? flow.nodes;
}

export function resolveDraftEdges(flow: FlowDefinition): FlowEdge[] {
  return flow.draftEdges ?? flow.edges;
}

export function flowGraphSnapshotKey(nodes: FlowNode[], edges: FlowEdge[]): string {
  return JSON.stringify({ nodes, edges });
}

export function hasUnpublishedFlowChanges(flow: FlowDefinition): boolean {
  return (
    flowGraphSnapshotKey(resolveDraftNodes(flow), resolveDraftEdges(flow)) !==
    flowGraphSnapshotKey(flow.nodes, flow.edges)
  );
}
