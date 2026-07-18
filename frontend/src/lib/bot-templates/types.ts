import type { LucideIcon } from "lucide-react";
import type { FlowEdge, FlowNode } from "@/types";

export type BotIndustryTemplateId = "health" | "retail" | "real_estate" | "support";

export type BotTemplateLocale = "es" | "en";

export interface BotFlowDefinition {
  name: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  entryNodeId: string;
  welcomeMessage: string;
}

export interface BotIndustryTemplate {
  id: BotIndustryTemplateId;
  icon: LucideIcon;
  getSystemPrompt(locale: BotTemplateLocale): string;
  getDefaultBotName(locale: BotTemplateLocale): string;
  getFlowDefinition(locale: BotTemplateLocale): BotFlowDefinition;
}
