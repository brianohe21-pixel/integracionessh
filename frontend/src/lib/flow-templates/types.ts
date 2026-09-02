import type { FlowEdge, FlowNode } from "@/types";

export type FlowTemplateId = "blank" | "service_quotation";

export interface FlowTemplateDefinition {
  nodes: FlowNode[];
  edges: FlowEdge[];
  entryNodeId: string;
}

export interface FlowTemplate {
  id: FlowTemplateId;
  name: { es: string; en: string };
  description: { es: string; en: string };
  defaultFlowName: { es: string; en: string };
  getDefinition(): FlowTemplateDefinition;
}
