import type { FlowDefinition, FlowEdge, FlowNode } from "../../types/index.js";
import { sanitizeEdgesForNodes } from "./graph.js";

export function resolveDraftNodes(flow: FlowDefinition): FlowNode[] {
  return flow.draftNodes ?? flow.nodes;
}

export function resolveDraftEdges(flow: FlowDefinition): FlowEdge[] {
  return flow.draftEdges ?? flow.edges;
}

export function resolveDraftEntryNodeId(flow: FlowDefinition): string {
  return flow.draftEntryNodeId ?? flow.entryNodeId;
}

export function flowGraphSnapshotKey(nodes: FlowNode[], edges: FlowEdge[]): string {
  return JSON.stringify({ nodes, edges: sanitizeEdgesForNodes(nodes, edges) });
}

export function hasUnpublishedChanges(flow: FlowDefinition): boolean {
  return (
    flowGraphSnapshotKey(resolveDraftNodes(flow), resolveDraftEdges(flow)) !==
    flowGraphSnapshotKey(flow.nodes, flow.edges)
  );
}

export function nextPublishedVersion(flow: FlowDefinition): number {
  return flow.publishedAt ? flow.version + 1 : 1;
}
