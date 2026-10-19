import type { Message } from "../../types/index.js";
import { getCachedTemplate } from "../dynamodb/template.repository.js";

export const WHATSAPP_PRICING_CATEGORIES = [
  "MARKETING",
  "UTILITY",
  "AUTHENTICATION",
  "SERVICE",
] as const;

export type WhatsAppPricingCategory = (typeof WHATSAPP_PRICING_CATEGORIES)[number];

export type WhatsAppCategoryMetricBucket =
  | "marketing"
  | "utility"
  | "authentication"
  | "service";

const CATEGORY_TO_BUCKET: Record<WhatsAppPricingCategory, WhatsAppCategoryMetricBucket> = {
  MARKETING: "marketing",
  UTILITY: "utility",
  AUTHENTICATION: "authentication",
  SERVICE: "service",
};

export function whatsappCategoryToBucket(
  category: WhatsAppPricingCategory
): WhatsAppCategoryMetricBucket {
  return CATEGORY_TO_BUCKET[category];
}

export function parseWhatsAppPricingCategory(
  value: unknown
): WhatsAppPricingCategory | null {
  if (typeof value !== "string") return null;
  const upper = value.trim().toUpperCase();
  if (
    upper === "MARKETING" ||
    upper === "UTILITY" ||
    upper === "AUTHENTICATION" ||
    upper === "SERVICE"
  ) {
    return upper;
  }
  return null;
}

export function isWhatsAppOutboundForCategory(
  message: Pick<Message, "channel" | "source" | "role">
): boolean {
  if ((message.channel ?? "whatsapp") !== "whatsapp") return false;
  if (message.source === "whatsapp_history") return false;
  if (message.source === "whatsapp_inbound" || message.role === "user") return false;
  if (message.source === "whatsapp_app_echo") return true;
  if (
    message.role === "advisor" ||
    message.role === "assistant" ||
    message.source === "panel"
  ) {
    return true;
  }
  return false;
}

function isTemplateMessage(message: Pick<Message, "metadata">): boolean {
  return message.metadata?.kind === "whatsapp_template";
}

export async function resolveWhatsAppPricingCategory(
  message: Message,
  botId: string
): Promise<WhatsAppPricingCategory | null> {
  if (!isWhatsAppOutboundForCategory(message)) return null;

  const stored = parseWhatsAppPricingCategory(message.metadata?.templateCategory);
  if (stored) return stored;

  if (isTemplateMessage(message)) {
    const templateName =
      typeof message.metadata?.templateName === "string"
        ? message.metadata.templateName.trim()
        : "";
    const language =
      typeof message.metadata?.language === "string"
        ? message.metadata.language.trim()
        : "";
    if (templateName && language) {
      const cached = await getCachedTemplate(
        message.tenantId,
        botId,
        templateName,
        language
      );
      const fromCache = parseWhatsAppPricingCategory(cached?.category);
      if (fromCache && fromCache !== "SERVICE") return fromCache;
    }
    return "UTILITY";
  }

  return "SERVICE";
}
