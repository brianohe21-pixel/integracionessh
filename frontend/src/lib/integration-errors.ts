import type { SupportTicketCategory } from "@/types";

export type IntegrationKind = "whatsapp" | "telnyx" | "google" | "microsoft" | "generic";

export interface IntegrationErrorContext {
  botId?: string;
  flow?: string;
  onboardingMode?: string;
  page?: string;
}

export interface MaskedIntegrationError {
  userMessage: string;
  rawMessage: string;
  referenceId: string;
  category: SupportTicketCategory;
  defaultSubject: string;
  supportMessage: string;
  showSupport: boolean;
}

const SAFE_ERROR_PATTERNS = [
  /pin must be exactly 6 digits/i,
  /enter a pin/i,
  /phone number is already connected/i,
  /create a bot before/i,
  /not configured/i,
  /multiple phone numbers found/i,
  /no phone numbers found/i,
  /invalid telnyx api key/i,
  /telnyx apikey is required/i,
  /phone number is already assigned/i,
];

function createReferenceId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  }
  return Date.now().toString(36).toUpperCase().slice(-8);
}

function integrationCategory(kind: IntegrationKind): SupportTicketCategory {
  if (kind === "whatsapp") return "whatsapp";
  if (kind === "telnyx") return "technical";
  if (kind === "google" || kind === "microsoft") return "technical";
  return "technical";
}

function isSafeUserMessage(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) return false;
  return SAFE_ERROR_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function shouldMask(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) return false;
  if (isSafeUserMessage(trimmed)) return false;

  return (
    /failed to exchange/i.test(trimmed) ||
    /graph\.facebook\.com/i.test(trimmed) ||
    /oauth/i.test(trimmed) ||
    /access token/i.test(trimmed) ||
    /network error calling/i.test(trimmed) ||
    /http 5\d\d/i.test(trimmed) ||
    /telnyx api error/i.test(trimmed) ||
    /subscribed_apps/i.test(trimmed) ||
    /whatsapp api error/i.test(trimmed) ||
    /internal server error/i.test(trimmed) ||
    /unknown error/i.test(trimmed) ||
    trimmed.length > 160 ||
    trimmed.includes("{") ||
    trimmed.includes("error_subcode")
  );
}

export function maskIntegrationError(
  rawError: string,
  t: (key: string, vars?: Record<string, string | number>) => string,
  kind: IntegrationKind,
  context: IntegrationErrorContext = {}
): MaskedIntegrationError {
  const rawMessage = rawError.trim() || t("integrations.errors.generic");
  const referenceId = createReferenceId();
  const category = integrationCategory(kind);
  const integrationLabel = t(`integrations.errors.kinds.${kind}`);

  const userMessage = shouldMask(rawMessage)
    ? t("integrations.errors.masked", { integration: integrationLabel, reference: referenceId })
    : rawMessage;

  const contextLines = [
    context.flow ? `Flow: ${context.flow}` : null,
    context.onboardingMode ? `Mode: ${context.onboardingMode}` : null,
    context.botId ? `Bot ID: ${context.botId}` : null,
    context.page ? `Page: ${context.page}` : null,
  ].filter(Boolean);

  const supportMessage = [
    t("integrations.errors.supportIntro", { integration: integrationLabel }),
    "",
    `Reference: ${referenceId}`,
    ...contextLines,
    "",
    t("integrations.errors.supportTechnicalDetails"),
    rawMessage,
  ].join("\n");

  return {
    userMessage,
    rawMessage,
    referenceId,
    category,
    defaultSubject: t("integrations.errors.defaultSubject", { integration: integrationLabel }),
    supportMessage,
    showSupport: shouldMask(rawMessage),
  };
}
