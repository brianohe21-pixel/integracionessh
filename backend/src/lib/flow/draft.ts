import type { FlowDefinition, FlowEdge, FlowNode } from "../../types/index.js";
import { sanitizeEdgesForNodes } from "./graph.js";
import { applyResolvedTriggerType, resolveFlowVoiceMode } from "./resolve-flow-trigger.js";

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
  const sortedNodes = [...nodes].sort((a, b) => a.id.localeCompare(b.id));
  const sortedEdges = [...sanitizeEdgesForNodes(nodes, edges)].sort((a, b) =>
    a.id.localeCompare(b.id)
  );
  return JSON.stringify({ nodes: sortedNodes, edges: sortedEdges });
}

export function hasUnpublishedChanges(flow: FlowDefinition): boolean {
  const draftNodes = resolveDraftNodes(flow);
  const draftEdges = resolveDraftEdges(flow);
  const voiceMode = resolveFlowVoiceMode(flow.flowKind, draftNodes, flow.nodes);
  const draftKey = flowGraphSnapshotKey(
    applyResolvedTriggerType(draftNodes, voiceMode),
    draftEdges
  );
  const publishedKey = flowGraphSnapshotKey(
    applyResolvedTriggerType(flow.nodes, voiceMode),
    flow.edges
  );
  return draftKey !== publishedKey;
}

export function nextPublishedVersion(flow: FlowDefinition): number {
  return flow.publishedAt ? flow.version + 1 : 1;
}
