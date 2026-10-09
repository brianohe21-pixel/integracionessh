import type { Message, WhatsAppTemplateDisplay } from "@/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

export function getWhatsAppTemplateDisplay(message: Message): WhatsAppTemplateDisplay | null {
  if (!isRecord(message.metadata) || message.metadata.kind !== "whatsapp_template") {
    return null;
  }

  const raw = message.metadata.display;
  if (!isRecord(raw)) return null;

  const headerText = typeof raw.headerText === "string" ? raw.headerText : undefined;
  const bodyText = typeof raw.bodyText === "string" ? raw.bodyText : undefined;
  const footerText = typeof raw.footerText === "string" ? raw.footerText : undefined;
  const buttons = Array.isArray(raw.buttons)
    ? raw.buttons.filter((button): button is string => typeof button === "string" && button.trim().length > 0)
    : undefined;

  if (!headerText && !bodyText && !footerText && !buttons?.length) return null;

  return {
    ...(headerText ? { headerText } : {}),
    ...(bodyText ? { bodyText } : {}),
    ...(footerText ? { footerText } : {}),
    ...(buttons?.length ? { buttons } : {}),
  };
}
