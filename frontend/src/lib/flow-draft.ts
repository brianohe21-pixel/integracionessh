import type { FlowDefinition, FlowEdge, FlowNode } from "@/types";
import { sanitizeFlowEdges } from "@/lib/flow-graph";

export function resolveDraftNodes(flow: FlowDefinition): FlowNode[] {
  return flow.draftNodes ?? flow.nodes;
}

export function resolveDraftEdges(flow: FlowDefinition): FlowEdge[] {
  return flow.draftEdges ?? flow.edges;
}

export function flowGraphSnapshotKey(nodes: FlowNode[], edges: FlowEdge[]): string {
  return JSON.stringify({ nodes, edges: sanitizeFlowEdges(nodes, edges) });
}

export function flowPublishedSnapshotKey(flow: FlowDefinition): string {
  return flowGraphSnapshotKey(flow.nodes, flow.edges);
}

export function flowDraftSnapshotKey(flow: FlowDefinition): string {
  return flowGraphSnapshotKey(resolveDraftNodes(flow), resolveDraftEdges(flow));
}

export function hasUnpublishedFlowChanges(flow: FlowDefinition): boolean {
  return flowDraftSnapshotKey(flow) !== flowPublishedSnapshotKey(flow);
}
