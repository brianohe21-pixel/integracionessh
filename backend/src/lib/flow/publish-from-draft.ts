import type { FlowDefinition } from "../../types/index.js";
import {
  nextPublishedVersion,
  resolveDraftEdges,
  resolveDraftEntryNodeId,
  resolveDraftNodes,
} from "./draft.js";
import { sanitizeFlowEdges } from "./graph.js";
import { withBotFromNodes } from "./resolve-flow-bot.js";

export function buildPublishedFlowFromDraft(existing: FlowDefinition): FlowDefinition {
  const draftNodes = resolveDraftNodes(existing);
  const draftEdges = resolveDraftEdges(existing);
  const draftEntryNodeId = resolveDraftEntryNodeId(existing);
  const publishedAt = new Date().toISOString();
  return sanitizeFlowEdges({
    ...withBotFromNodes({
      ...existing,
      nodes: draftNodes,
      edges: draftEdges,
      entryNodeId: draftEntryNodeId,
      draftNodes,
      draftEdges,
      draftEntryNodeId,
    }),
    version: nextPublishedVersion(existing),
    publishedAt,
  });
}
