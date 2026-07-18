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
  { border: string; bg: string; icon: string; badge: string }
> = {
  entry: {
    border: "border-emerald-300",
    bg: "bg-emerald-50",
    icon: "text-emerald-600",
    badge: "bg-emerald-100 text-emerald-800",
  },
  messaging: {
    border: "border-blue-300",
    bg: "bg-blue-50",
    icon: "text-blue-600",
    badge: "bg-blue-100 text-blue-800",
  },
  logic: {
    border: "border-amber-300",
    bg: "bg-amber-50",
    icon: "text-amber-600",
    badge: "bg-amber-100 text-amber-800",
  },
  integrations: {
    border: "border-violet-300",
    bg: "bg-violet-50",
    icon: "text-violet-600",
    badge: "bg-violet-100 text-violet-800",
  },
  apps: {
    border: "border-indigo-300",
    bg: "bg-indigo-50",
    icon: "text-indigo-600",
    badge: "bg-indigo-100 text-indigo-800",
  },
  end: {
    border: "border-gray-300",
    bg: "bg-gray-50",
    icon: "text-gray-600",
    badge: "bg-gray-100 text-gray-800",
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
