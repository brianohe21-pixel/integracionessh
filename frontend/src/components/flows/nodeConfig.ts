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
  Tags,
  Tag,
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
  assign_tags: { category: "crm", icon: Tags, hasInput: true, hasOutput: true },
  remove_tags: { category: "crm", icon: Tag, hasInput: true, hasOutput: true },
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
    "assign_tags",
    "remove_tags",
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

const OPPORTUNITY_STAGE_LABELS: Record<string, { es: string; en: string }> = {
  new: { es: "Nueva", en: "New" },
  quoted: { es: "Cotizada", en: "Quoted" },
  negotiation: { es: "Negociación", en: "Negotiation" },
  won: { es: "Ganada", en: "Won" },
  lost: { es: "Perdida", en: "Lost" },
};

const CONDITION_OPERATOR_LABELS: Record<string, { es: string; en: string }> = {
  contains: { es: "contiene", en: "contains" },
  equals: { es: "=", en: "=" },
  not_equals: { es: "≠", en: "≠" },
  matches: { es: "coincide", en: "matches" },
  not_matches: { es: "no coincide", en: "does not match" },
};

function formatDelaySeconds(seconds: number, locale: "es" | "en"): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (rest === 0) {
    return locale === "es" ? `${minutes} min` : `${minutes} min`;
  }
  return `${minutes}m ${rest}s`;
}

function formatHttpPreview(method: string, url: string, max = 52): string {
  const prefix = method ? `${method} ` : "";
  const available = Math.max(12, max - prefix.length);
  if (url.length <= available) return `${prefix}${url}`.trim();
  try {
    const parsed = new URL(url);
    const hostPath = `${parsed.host}${parsed.pathname}`;
    const short =
      hostPath.length > available
        ? `${hostPath.slice(0, available - 1)}…`
        : hostPath;
    return `${prefix}${short}`.trim();
  } catch {
    return `${prefix}${url.length > available ? `${url.slice(0, available - 1)}…` : url}`.trim();
  }
}

function joinOptionTitles(
  titles: string[],
  locale: "es" | "en",
  truncate: (s: string, max?: number) => string
): string {
  const cleaned = titles.map((title) => title.trim()).filter(Boolean);
  if (!cleaned.length) {
    return locale === "es" ? "Sin opciones" : "No options";
  }
  const countLabel =
    locale === "es"
      ? `${cleaned.length} opción${cleaned.length === 1 ? "" : "es"}`
      : `${cleaned.length} option${cleaned.length === 1 ? "" : "s"}`;
  return truncate(`${countLabel} · ${cleaned.join(" · ")}`, 56);
}

export function buildNodePreview(
  type: FlowNodeType,
  data: FlowNodeData,
  locale: "es" | "en" = "es",
  botNames?: Record<string, string>,
  advisorNames?: Record<string, string>
): string {
  const truncate = (s: string, max = 48) =>
    s.length > max ? `${s.slice(0, max)}…` : s;
  const text = (value: LocalizedText | undefined, max = 48) =>
    truncate(resolveLocalizedText(value, locale), max);
  const stageLabel = (stage: string) =>
    OPPORTUNITY_STAGE_LABELS[stage]?.[locale] ?? stage;

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
      const stage =
        !data.triggerStageKey
          ? locale === "es"
            ? "Cualquier etapa"
            : "Any stage"
          : stageLabel(data.triggerStageKey);
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
      } else if (channel === "any") {
        channelLabel = locale === "es" ? "Cualquier canal" : "Any channel";
      }
      return [botLabel, channelLabel].filter(Boolean).join(" · ") ||
        (locale === "es" ? "Agente" : "Agent");
    }
    case "message": {
      const body = text(data.messageText, 72);
      if (!body) return locale === "es" ? "Sin texto" : "No text";
      if (data.waitForReply) {
        return `${body}\n${locale === "es" ? "Espera respuesta" : "Waits for reply"}`;
      }
      return body;
    }
    case "template": {
      if (!data.templateName) {
        return locale === "es" ? "Sin plantilla" : "No template";
      }
      const vars = Object.keys(data.templateVariables ?? {}).length;
      const base = `${data.templateName} (${data.templateLanguage ?? "?"})`;
      if (!vars) return truncate(base);
      return truncate(
        locale === "es" ? `${base} · ${vars} vars` : `${base} · ${vars} vars`
      );
    }
    case "condition": {
      const variable = data.conditionVariable ?? "last_input";
      const operatorKey = data.conditionOperator ?? "contains";
      const operator =
        CONDITION_OPERATOR_LABELS[operatorKey]?.[locale] ?? operatorKey;
      const value = data.conditionValue?.trim() ?? "";
      return truncate(`${variable} ${operator} ${value}`.trim(), 56);
    }
    case "check_known_contact":
      return locale === "es" ? "¿Ya está en contactos?" : "Already in contacts?";
    case "buttons": {
      const prompt = text(data.messageText, 56);
      const options = joinOptionTitles(
        (data.buttons ?? []).map((btn) => resolveLocalizedText(btn.title, locale)),
        locale,
        truncate
      );
      return prompt ? `${prompt}\n${options}` : options;
    }
    case "list": {
      const prompt = text(data.messageText, 56);
      const options = joinOptionTitles(
        (data.listItems ?? []).map((item) => resolveLocalizedText(item.title, locale)),
        locale,
        truncate
      );
      return prompt ? `${prompt}\n${options}` : options;
    }
    case "meta_flow": {
      const cta = text(data.metaFlowCta, 40);
      const flowId = data.metaFlowId?.trim();
      if (cta && flowId) return `${cta}\n${truncate(flowId, 36)}`;
      return cta || flowId || (locale === "es" ? "Sin formulario" : "No form");
    }
    case "handoff": {
      const advisorId = data.advisorId?.trim();
      if (!advisorId) {
        return locale === "es" ? "Asignación automática" : "Auto assign";
      }
      const advisorLabel = truncate(
        advisorNames?.[advisorId] || advisorId,
        36
      );
      return locale === "es" ? `Asesor · ${advisorLabel}` : `Advisor · ${advisorLabel}`;
    }
    case "delay":
      return formatDelaySeconds(data.delaySeconds ?? 5, locale);
    case "set_variable":
      return data.variableName
        ? truncate(`${data.variableName} = ${data.variableValue ?? ""}`, 56)
        : locale === "es"
          ? "Sin variable"
          : "No variable";
    case "http_request": {
      const method = (data.httpMethod ?? "GET").toUpperCase();
      const url = data.httpUrl?.trim() ?? "";
      if (!url) {
        return locale === "es" ? `${method} · Sin URL` : `${method} · No URL`;
      }
      return formatHttpPreview(method, url);
    }
    case "book_appointment": {
      const confirmation = text(data.confirmationMessage, 56);
      const days =
        data.maxDaysToShow != null
          ? locale === "es"
            ? `${data.maxDaysToShow} días`
            : `${data.maxDaysToShow} days`
          : "";
      return [confirmation, days].filter(Boolean).join(" · ") ||
        (locale === "es" ? "Agendar cita" : "Book appointment");
    }
    case "cloud_drive_write": {
      const provider = data.cloudDriveProvider ?? "google-drive";
      const target = data.cloudDriveTargetType ?? "document";
      const file = data.cloudDriveFileName || data.cloudDriveFileId || "";
      return truncate(`${provider} · ${target} · ${file}`);
    }
    case "request_payment": {
      const description = text(data.paymentDescription, 40);
      const amount =
        data.amountInCents != null
          ? `$${(data.amountInCents / 100).toFixed(2)}`
          : "";
      return [amount, description].filter(Boolean).join(" · ") ||
        (locale === "es" ? "Sin monto" : "No amount");
    }
    case "send_catalog":
      return text(data.catalogMessageText, 56) ||
        (locale === "es" ? "Catálogo" : "Catalog");
    case "send_products": {
      const prompt = text(data.messageText, 40);
      const count = data.productRetailerIds?.filter((id) => id.trim()).length ?? 0;
      const countLabel =
        count > 0
          ? locale === "es"
            ? `${count} producto${count === 1 ? "" : "s"}`
            : `${count} product${count === 1 ? "" : "s"}`
          : locale === "es"
            ? "Sin productos"
            : "No products";
      return prompt ? `${prompt}\n${countLabel}` : countLabel;
    }
    case "await_order":
      return text(data.messageText, 56) ||
        text(data.orderConfirmationMessage, 56) ||
        (locale === "es" ? "Espera pedido" : "Await order");
    case "send_otp": {
      const msg = text(data.otpMessageText, 40);
      const template = data.otpWhatsAppTemplateName?.trim();
      const attempts =
        data.otpMaxAttempts != null
          ? locale === "es"
            ? `${data.otpMaxAttempts} intentos`
            : `${data.otpMaxAttempts} attempts`
          : "";
      return [msg || template || "OTP", attempts].filter(Boolean).join(" · ");
    }
    case "send_audio":
      return data.audioFilename ||
        (data.audioS3Key
          ? locale === "es"
            ? "Nota de voz"
            : "Voice note"
          : locale === "es"
            ? "Sin audio"
            : "No audio");
    case "save_contact": {
      const parts = [
        data.contactPhoneBinding,
        data.contactNameBinding,
        data.contactEmailBinding,
      ]
        .map((item) => item?.trim())
        .filter(Boolean) as string[];
      return parts.length
        ? truncate(parts.join(" · "), 56)
        : locale === "es"
          ? "Sin campos"
          : "No fields";
    }
    case "create_lead": {
      const parts = [
        data.leadPhoneBinding,
        data.leadNameBinding,
        data.leadEmailBinding,
      ]
        .map((item) => item?.trim())
        .filter(Boolean) as string[];
      const tags = data.leadTags?.filter((tag) => tag.trim()) ?? [];
      if (tags.length) parts.push(tags.join(", "));
      return parts.length
        ? truncate(parts.join(" · "), 56)
        : locale === "es"
          ? "Sin campos"
          : "No fields";
    }
    case "assign_tags":
    case "remove_tags": {
      const tags = data.contactTags?.filter((tag) => tag.trim()) ?? [];
      if (!tags.length) {
        return locale === "es" ? "Sin etiquetas" : "No tags";
      }
      return truncate(tags.join(", "));
    }
    case "move_opportunity_stage": {
      const stage = data.opportunityStage ?? "quoted";
      return [
        data.opportunityIdBinding ?? "{{opportunity_id}}",
        stageLabel(stage),
      ]
        .filter(Boolean)
        .join(" → ");
    }
    case "create_opportunity": {
      const stage = data.opportunityStage ?? "new";
      const title = data.opportunityTitleBinding?.trim();
      const amount = data.opportunityAmountBinding?.trim();
      const currency = data.opportunityCurrency ?? "USD";
      const phone = data.opportunityPhoneBinding?.trim();
      const meta = [
        stageLabel(stage),
        amount ? `${amount} ${currency}` : "",
        phone ?? "",
      ].filter(Boolean);
      if (title && meta.length) {
        return `${truncate(title, 40)}\n${truncate(meta.join(" · "), 48)}`;
      }
      if (title) return truncate(title);
      return truncate(meta.join(" · ")) ||
        (locale === "es" ? "Nueva oportunidad" : "New opportunity");
    }
    case "send_notification": {
      const channel = data.notificationChannel ?? "whatsapp";
      const channelLabel: Record<string, string> = {
        whatsapp: "WhatsApp",
        sms: "SMS",
        email: "Email",
      };
      if (channel === "email") {
        const recipients =
          data.notificationRecipientBindings?.filter((item) => item.trim()).join(", ") ||
          data.notificationRecipientBinding ||
          "";
        const subject = data.notificationEmailSubject?.trim();
        return truncate(
          [`[${channelLabel[channel]}]`, recipients, subject].filter(Boolean).join(" "),
          56
        );
      }
      const recipient = data.notificationRecipientBinding ?? "";
      if (data.notificationMessageType === "template") {
        return truncate(
          `[${channelLabel[channel]}] ${data.notificationTemplateName ?? ""}`.trim()
        );
      }
      const message = text(data.notificationMessageText, 28);
      return truncate(
        [`[${channelLabel[channel]}]`, recipient, message].filter(Boolean).join(" "),
        56
      );
    }
    case "assign_bot": {
      const botLabel = data.botId
        ? truncate(botNames?.[data.botId] || data.botId, 28)
        : locale === "es"
          ? "Asistente IA"
          : "AI Assistant";
      return botLabel;
    }
    case "webhook": {
      const keys = Object.keys(data.formSamplePayload ?? {});
      if (keys.length) {
        return truncate(
          locale === "es"
            ? `Espera POST · ${keys.join(", ")}`
            : `Wait for POST · ${keys.join(", ")}`,
          56
        );
      }
      return locale === "es" ? "Espera POST · JSON" : "Wait for POST · JSON";
    }
    case "end":
      return data.haltPipeline === false
        ? locale === "es"
          ? "Continúa pipeline"
          : "Continue pipeline"
        : locale === "es"
          ? "Fin del flujo"
          : "End of flow";
  }
  return data.label ?? "";
}
