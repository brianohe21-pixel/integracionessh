import type { LucideIcon } from "lucide-react";
import {
  Play,
  MessageSquare,
  FileText,
  GitBranch,
  MousePointerClick,
  FormInput,
  UserRound,
  Clock,
  Variable,
  Globe,
  Calendar,
  CreditCard,
  ShoppingBag,
  Package,
  ShoppingCart,
  Square,
} from "lucide-react";
import type { FlowNodeData, FlowNodeType } from "@/types";

export type FlowNodeCategory =
  | "entry"
  | "messaging"
  | "logic"
  | "integrations"
  | "apps"
  | "end";

export interface FlowNodeMeta {
  category: FlowNodeCategory;
  icon: LucideIcon;
  hasInput: boolean;
  hasOutput: boolean;
  branchHandles?: "condition" | "buttons";
}

export const FLOW_NODE_META: Record<FlowNodeType, FlowNodeMeta> = {
  trigger: { category: "entry", icon: Play, hasInput: false, hasOutput: true },
  message: { category: "messaging", icon: MessageSquare, hasInput: true, hasOutput: true },
  template: { category: "messaging", icon: FileText, hasInput: true, hasOutput: true },
  buttons: {
    category: "messaging",
    icon: MousePointerClick,
    hasInput: true,
    hasOutput: true,
    branchHandles: "buttons",
  },
  condition: {
    category: "logic",
    icon: GitBranch,
    hasInput: true,
    hasOutput: true,
    branchHandles: "condition",
  },
  delay: { category: "logic", icon: Clock, hasInput: true, hasOutput: true },
  set_variable: { category: "logic", icon: Variable, hasInput: true, hasOutput: true },
  meta_flow: { category: "integrations", icon: FormInput, hasInput: true, hasOutput: true },
  http_request: { category: "integrations", icon: Globe, hasInput: true, hasOutput: true },
  handoff: { category: "integrations", icon: UserRound, hasInput: true, hasOutput: true },
  book_appointment: { category: "apps", icon: Calendar, hasInput: true, hasOutput: true },
  request_payment: { category: "apps", icon: CreditCard, hasInput: true, hasOutput: true },
  send_catalog: { category: "apps", icon: ShoppingBag, hasInput: true, hasOutput: true },
  send_products: { category: "apps", icon: Package, hasInput: true, hasOutput: true },
  await_order: { category: "apps", icon: ShoppingCart, hasInput: true, hasOutput: true },
  end: { category: "end", icon: Square, hasInput: true, hasOutput: false },
};

export type FlowPaletteCategory = Exclude<FlowNodeCategory, "entry">;

export const FLOW_NODE_CATEGORIES: FlowPaletteCategory[] = [
  "messaging",
  "logic",
  "integrations",
  "apps",
  "end",
];

export const FLOW_PALETTE_NODES: Record<FlowPaletteCategory, FlowNodeType[]> = {
  messaging: ["message", "template", "buttons"],
  logic: ["condition", "delay", "set_variable"],
  integrations: ["meta_flow", "http_request", "handoff"],
  apps: [
    "book_appointment",
    "request_payment",
    "send_catalog",
    "send_products",
    "await_order",
  ],
  end: ["end"],
};

export const CATEGORY_STYLES: Record<
  FlowNodeCategory,
  { border: string; bg: string; icon: string; badge: string; handle: string }
> = {
  entry: {
    border: "border-success/40",
    bg: "bg-surface-elevated/80 backdrop-blur-md",
    icon: "text-success",
    badge: "bg-success/15 text-success",
    handle: "!bg-success",
  },
  messaging: {
    border: "border-info/40",
    bg: "bg-surface-elevated/80 backdrop-blur-md",
    icon: "text-info",
    badge: "bg-info/15 text-info",
    handle: "!bg-info",
  },
  logic: {
    border: "border-warning/40",
    bg: "bg-surface-elevated/80 backdrop-blur-md",
    icon: "text-warning",
    badge: "bg-warning/15 text-warning",
    handle: "!bg-warning",
  },
  integrations: {
    border: "border-human/40",
    bg: "bg-surface-elevated/80 backdrop-blur-md",
    icon: "text-human",
    badge: "bg-human/15 text-human",
    handle: "!bg-human",
  },
  apps: {
    border: "border-accent/40",
    bg: "bg-surface-elevated/80 backdrop-blur-md",
    icon: "text-accent",
    badge: "bg-accent-muted text-accent",
    handle: "!bg-accent",
  },
  end: {
    border: "border-default",
    bg: "bg-surface-elevated/80 backdrop-blur-md",
    icon: "text-muted",
    badge: "bg-surface-muted text-secondary",
    handle: "!bg-muted",
  },
};

export function buildNodePreview(type: FlowNodeType, data: FlowNodeData): string {
  const truncate = (s: string, max = 48) =>
    s.length > max ? `${s.slice(0, max)}…` : s;

  switch (type) {
    case "trigger": {
      const triggerType = data.triggerType ?? "any_message";
      if (triggerType === "keyword" && data.keywords?.length) {
        return truncate(data.keywords.join(", "));
      }
      return triggerType;
    }
    case "message":
      return truncate(data.messageText ?? "");
    case "template":
      return data.templateName ? `${data.templateName} (${data.templateLanguage ?? "?"})` : "";
    case "condition":
      return `${data.conditionVariable ?? "last_input"} ${data.conditionOperator ?? "contains"} ${data.conditionValue ?? ""}`.trim();
    case "buttons":
      return truncate(data.messageText ?? "");
    case "meta_flow":
      return data.metaFlowCta ?? data.metaFlowId ?? "";
    case "delay":
      return `${data.delaySeconds ?? 5}s`;
    case "set_variable":
      return data.variableName ? `${data.variableName} = ${data.variableValue ?? ""}` : "";
    case "http_request":
      return truncate(data.httpUrl ?? "");
    case "book_appointment":
      return truncate(data.confirmationMessage ?? "");
    case "request_payment":
      return data.paymentDescription ?? "";
    case "send_catalog":
      return truncate(data.catalogMessageText ?? "");
    case "send_products":
      return truncate(data.messageText ?? "");
    case "await_order":
      return truncate(data.messageText ?? data.orderConfirmationMessage ?? "");
  }
  return data.label ?? "";
}
