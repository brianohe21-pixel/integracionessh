import type { FlowDefinition, FlowEdge, FlowNode } from "@/types";
import { sanitizeFlowEdges } from "@/lib/flow-graph";
import { applyResolvedTriggerType } from "@/lib/resolve-flow-trigger";

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

export function isVoiceFlowFromNodes(flow: FlowDefinition, nodes: FlowNode[]): boolean {
  return (
    flow.flowKind === "voice_ai" ||
    nodes.find((node) => node.type === "trigger")?.data.triggerType === "voice_call"
  );
}

export function resolveFlowVoiceMode(flow: FlowDefinition): boolean {
  if (flow.flowKind === "voice_ai") return true;
  const nodes = [...resolveDraftNodes(flow), ...flow.nodes];
  return nodes.some(
    (node) => node.type === "trigger" && node.data.triggerType === "voice_call"
  );
}

export function flowEditorSnapshotKey(
  nodes: FlowNode[],
  edges: FlowEdge[],
  isVoiceFlow: boolean
): string {
  return flowGraphSnapshotKey(applyResolvedTriggerType(nodes, isVoiceFlow), edges);
}

export function flowDraftEditorSnapshotKey(flow: FlowDefinition): string {
  const nodes = resolveDraftNodes(flow);
  const edges = resolveDraftEdges(flow);
  return flowEditorSnapshotKey(nodes, edges, resolveFlowVoiceMode(flow));
}

export function flowPublishedEditorSnapshotKey(flow: FlowDefinition): string {
  return flowEditorSnapshotKey(
    flow.nodes,
    flow.edges,
    resolveFlowVoiceMode(flow)
  );
}

export function hasUnpublishedFlowChanges(flow: FlowDefinition): boolean {
  return flowDraftEditorSnapshotKey(flow) !== flowPublishedEditorSnapshotKey(flow);
}
