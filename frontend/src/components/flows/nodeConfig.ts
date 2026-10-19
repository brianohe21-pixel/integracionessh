import type { LucideIcon } from "lucide-react";
import {
  Play,
  MessageCircle,
  Flag,
  MessageSquare,
  FileText,
  GitBranch,
  MousePointerClick,
  List,
  FormInput,
  UserRound,
  Clock,
  Variable,
  Globe,
  Calendar,
  HardDrive,
  CreditCard,
  ShoppingBag,
  Package,
  ShoppingCart,
  Square,
  Contact,
  ContactRound,
  UserPlus,
  Target,
  Kanban,
  Bell,
  Webhook,
  Bot,
  ShieldCheck,
  Headset,
  Mic,
} from "lucide-react";
import type { FlowNodeData, FlowNodeType, LocalizedText } from "@/types";
import { resolveConfiguredWhatsAppChannelIds } from "@/lib/flow-whatsapp-channels";
import { resolveLocalizedText } from "@/lib/localized-text";

export type FlowNodeCategory =
  | "entry"
  | "messaging"
  | "logic"
  | "integrations"
  | "crm"
  | "apps"
  | "end";

export interface FlowNodeMeta {
  category: FlowNodeCategory;
  icon: LucideIcon;
  hasInput: boolean;
  hasOutput: boolean;
  branchHandles?: "condition" | "buttons" | "otp";
}

export const FLOW_NODE_META: Record<FlowNodeType, FlowNodeMeta> = {
  trigger: { category: "entry", icon: Play, hasInput: false, hasOutput: true },
  message_received_trigger: {
    category: "entry",
    icon: MessageCircle,
    hasInput: false,
    hasOutput: true,
  },
  opportunity_stage_trigger: {
    category: "entry",
    icon: Flag,
    hasInput: false,
    hasOutput: true,
  },
  agent: { category: "integrations", icon: Headset, hasInput: true, hasOutput: true },
  message: { category: "messaging", icon: MessageSquare, hasInput: true, hasOutput: true },
  template: { category: "messaging", icon: FileText, hasInput: true, hasOutput: true },
  send_otp: {
    category: "messaging",
    icon: ShieldCheck,
    hasInput: true,
    hasOutput: true,
    branchHandles: "otp",
  },
  send_audio: { category: "messaging", icon: Mic, hasInput: true, hasOutput: true },
  buttons: {
    category: "messaging",
    icon: MousePointerClick,
    hasInput: true,
    hasOutput: true,
    branchHandles: "buttons",
  },
  list: {
    category: "messaging",
    icon: List,
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
  check_known_contact: {
    category: "crm",
    icon: ContactRound,
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
  cloud_drive_write: { category: "apps", icon: HardDrive, hasInput: true, hasOutput: true },
  request_payment: { category: "apps", icon: CreditCard, hasInput: true, hasOutput: true },
  send_catalog: { category: "apps", icon: ShoppingBag, hasInput: true, hasOutput: true },
  send_products: { category: "apps", icon: Package, hasInput: true, hasOutput: true },
  await_order: { category: "apps", icon: ShoppingCart, hasInput: true, hasOutput: true },
  save_contact: { category: "crm", icon: Contact, hasInput: true, hasOutput: true },
  create_lead: { category: "crm", icon: UserPlus, hasInput: true, hasOutput: true },
  create_opportunity: { category: "crm", icon: Target, hasInput: true, hasOutput: true },
  move_opportunity_stage: {
    category: "crm",
    icon: Kanban,
    hasInput: true,
    hasOutput: true,
    branchHandles: "condition",
  },
  send_notification: { category: "crm", icon: Bell, hasInput: true, hasOutput: true },
  assign_bot: { category: "integrations", icon: Bot, hasInput: true, hasOutput: true },
  webhook: { category: "integrations", icon: Webhook, hasInput: true, hasOutput: true },
  end: { category: "end", icon: Square, hasInput: true, hasOutput: false },
};

export type FlowPaletteCategory = FlowNodeCategory;

export const FLOW_NODE_CATEGORIES: FlowPaletteCategory[] = [
  "entry",
  "crm",
  "messaging",
  "logic",
  "integrations",
  "apps",
  "end",
];

export const FLOW_PALETTE_NODES: Record<FlowPaletteCategory, FlowNodeType[]> = {
  entry: ["message_received_trigger"],
  crm: [
    "save_contact",
    "check_known_contact",
    "create_lead",
    "create_opportunity",
    "move_opportunity_stage",
    "send_notification",
  ],
  messaging: [
    "message",
    "template",
    "buttons",
    "list",
    "send_otp",
    "send_audio",
  ],
  logic: ["condition", "delay", "set_variable"],
  integrations: ["agent", "assign_bot", "meta_flow", "http_request", "handoff"],
  apps: [
    "book_appointment",
    "cloud_drive_write",
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
  crm: {
    border: "border-success/40",
    bg: "bg-surface-elevated/80 backdrop-blur-md",
    icon: "text-success",
    badge: "bg-success/15 text-success",
    handle: "!bg-success",
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

export function buildNodePreview(
  type: FlowNodeType,
  data: FlowNodeData,
  locale: "es" | "en" = "es",
  botNames?: Record<string, string>
): string {
  const truncate = (s: string, max = 48) =>
    s.length > max ? `${s.slice(0, max)}…` : s;
  const text = (value: LocalizedText | undefined) =>
    truncate(resolveLocalizedText(value, locale));

  switch (type) {
    case "trigger": {
      const triggerType = data.triggerType ?? "any_message";
      if (triggerType === "web_form_submitted") {
        return locale === "es" ? "Webhook · espera POST" : "Webhook · waits for POST";
      }
      if (triggerType === "voice_call") {
        return locale === "es" ? "Voz" : "Voice";
      }
      return locale === "es" ? "Mensaje" : "Message";
    }
    case "message_received_trigger": {
      if ((data.triggerType ?? "any_message") === "web_form_submitted") {
        return locale === "es" ? "Webhook · espera POST" : "Webhook · waits for POST";
      }
      const parts: string[] = [locale === "es" ? "Mensaje" : "Message"];
      const botLabel = data.botId
        ? truncate(botNames?.[data.botId] || data.botId, 28)
        : "";
      if (botLabel) parts.push(botLabel);
      const channel = data.channel ?? "any";
      parts.push(channel === "any" ? (locale === "es" ? "Cualquier canal" : "Any channel") : channel);
      if (channel === "whatsapp") {
        const channelIds = resolveConfiguredWhatsAppChannelIds(data);
        if (channelIds.length === 0) {
          parts.push(locale === "es" ? "Todos los números" : "All numbers");
        } else if (channelIds.length === 1) {
          parts.push(locale === "es" ? "1 número" : "1 number");
        } else {
          parts.push(
            locale === "es"
              ? `${channelIds.length} números`
              : `${channelIds.length} numbers`
          );
        }
      }
      if ((data.triggerType ?? "any_message") === "first_message") {
        parts.push(locale === "es" ? "Primer mensaje" : "First message");
      }
      if (data.keywords?.length) {
        parts.push(truncate(data.keywords.join(", ")));
      }
      return parts.join(" · ");
    }
    case "opportunity_stage_trigger": {
      const stageLabels: Record<string, { es: string; en: string }> = {
        new: { es: "Nueva", en: "New" },
        quoted: { es: "Cotizada", en: "Quoted" },
        negotiation: { es: "Negociación", en: "Negotiation" },
        won: { es: "Ganada", en: "Won" },
        lost: { es: "Perdida", en: "Lost" },
      };
      const stage =
        !data.triggerStageKey
          ? locale === "es"
            ? "Cualquier etapa"
            : "Any stage"
          : stageLabels[data.triggerStageKey]?.[locale] ?? data.triggerStageKey;
      return `${locale === "es" ? "Etapa" : "Stage"} · ${stage}`;
    }
    case "agent": {
      const channel = data.channel ?? "any";
      const botLabel = data.botId
        ? truncate(botNames?.[data.botId] || data.botId, 28)
        : "";
      let channelLabel: string = channel;
      if (channel === "whatsapp") {
        const channelIds = resolveConfiguredWhatsAppChannelIds(data);
        channelLabel =
          channelIds.length === 0
            ? locale === "es"
              ? "whatsapp · todos"
              : "whatsapp · all"
            : locale === "es"
              ? `whatsapp · ${channelIds.length} núm.`
              : `whatsapp · ${channelIds.length} no.`;
      }
      return [botLabel, channelLabel].filter(Boolean).join(" · ");
    }
    case "message":
      return text(data.messageText);
    case "template":
      return data.templateName ? `${data.templateName} (${data.templateLanguage ?? "?"})` : "";
    case "condition":
      return `${data.conditionVariable ?? "last_input"} ${data.conditionOperator ?? "contains"} ${data.conditionValue ?? ""}`.trim();
    case "check_known_contact":
      return locale === "es" ? "¿Ya está en contactos?" : "Already in contacts?";
    case "buttons":
      return text(data.messageText);
    case "list":
      return text(data.messageText);
    case "meta_flow":
      return text(data.metaFlowCta) || data.metaFlowId || "";
    case "delay":
      return `${data.delaySeconds ?? 5}s`;
    case "set_variable":
      return data.variableName ? `${data.variableName} = ${data.variableValue ?? ""}` : "";
    case "http_request":
      return truncate(data.httpUrl ?? "");
    case "book_appointment":
      return text(data.confirmationMessage);
    case "cloud_drive_write": {
      const provider = data.cloudDriveProvider ?? "google-drive";
      const target = data.cloudDriveTargetType ?? "document";
      const file = data.cloudDriveFileName || data.cloudDriveFileId || "";
      return truncate(`${provider} · ${target} · ${file}`);
    }
    case "request_payment":
      return text(data.paymentDescription);
    case "send_catalog":
      return text(data.catalogMessageText);
    case "send_products":
      return text(data.messageText);
    case "await_order":
      return text(data.messageText) || text(data.orderConfirmationMessage);
    case "send_otp":
      return text(data.otpMessageText) || data.otpWhatsAppTemplateName || "OTP";
    case "send_audio":
      return data.audioFilename || (data.audioS3Key ? "voice note" : "");
    case "save_contact":
      return data.contactPhoneBinding ?? "";
    case "create_lead":
      return data.leadPhoneBinding ?? "";
    case "move_opportunity_stage": {
      const stageLabels: Record<string, { es: string; en: string }> = {
        new: { es: "Nueva", en: "New" },
        quoted: { es: "Cotizada", en: "Quoted" },
        negotiation: { es: "Negociación", en: "Negotiation" },
        won: { es: "Ganada", en: "Won" },
        lost: { es: "Perdida", en: "Lost" },
      };
      const stage = data.opportunityStage ?? "quoted";
      const stageLabel = stageLabels[stage]?.[locale] ?? stage;
      return [data.opportunityIdBinding ?? "{{opportunity_id}}", stageLabel]
        .filter(Boolean)
        .join(" → ");
    }
    case "create_opportunity": {
      const stageLabels: Record<string, { es: string; en: string }> = {
        new: { es: "Nueva", en: "New" },
        quoted: { es: "Cotizada", en: "Quoted" },
        negotiation: { es: "Negociación", en: "Negotiation" },
        won: { es: "Ganada", en: "Won" },
        lost: { es: "Perdida", en: "Lost" },
      };
      const stage = data.opportunityStage ?? "new";
      const stageLabel = stageLabels[stage]?.[locale] ?? stage;
      const title = data.opportunityTitleBinding?.trim();
      const amount = data.opportunityAmountBinding?.trim();
      const currency = data.opportunityCurrency ?? "USD";
      const phone = data.opportunityPhoneBinding?.trim();
      const meta = [
        stageLabel,
        amount ? `${amount} ${currency}` : "",
        phone ?? "",
      ].filter(Boolean);
      if (title && meta.length) {
        return `${truncate(title, 40)}\n${truncate(meta.join(" · "), 48)}`;
      }
      if (title) return truncate(title);
      return truncate(meta.join(" · "));
    }
    case "send_notification": {
      const channel = data.notificationChannel ?? "whatsapp";
      const channelLabel: Record<string, string> = { whatsapp: "WhatsApp", sms: "SMS", email: "Email" };
      if (channel === "email") {
        const recipients =
          data.notificationRecipientBindings?.filter((item) => item.trim()).join(", ") ||
          data.notificationRecipientBinding ||
          "";
        return truncate(`[${channelLabel[channel]}] ${recipients}`.trim());
      }
      const recipient = data.notificationRecipientBinding ?? "";
      if (data.notificationMessageType === "template") {
        return truncate(`[${channelLabel[channel]}] ${data.notificationTemplateName ?? ""}`.trim());
      }
      return truncate(`[${channelLabel[channel]}] ${recipient}`.trim());
    }
    case "assign_bot": {
      const botLabel = data.botId
        ? truncate(botNames?.[data.botId] || data.botId, 28)
        : locale === "es"
          ? "Asistente IA"
          : "AI Assistant";
      return botLabel;
    }
    case "webhook":
      return locale === "es" ? "Recibir JSON" : "Receive JSON";
  }
  return data.label ?? "";
}
