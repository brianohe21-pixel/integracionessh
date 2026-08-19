import type { FlowDefinition, FlowNode } from "@/types";

export function extractFlowSecretRefsFromNodes(nodes: FlowNode[]): string[] {
  const refs = new Set<string>();
  const pattern = /\{\{secret\.([^}]+)\}\}/g;
  for (const node of nodes) {
    if (node.type !== "http_request") continue;
    const parts = [
      node.data.httpUrl ?? "",
      node.data.httpBody ?? "",
      ...(node.data.httpHeaders ?? []).flatMap((header) => [header.key, header.value]),
    ];
    for (const part of parts) {
      let match: RegExpExecArray | null;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(part)) !== null) {
        refs.add(match[1].trim());
      }
    }
  }
  return [...refs].sort();
}

export function extractFlowSecretRefs(flow: FlowDefinition): string[] {
  return extractFlowSecretRefsFromNodes(flow.nodes);
}
