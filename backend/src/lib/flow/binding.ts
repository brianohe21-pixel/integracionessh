import { normalizePhone } from "../dynamodb/contact.repository.js";
import { isWhatsAppBsuid } from "../whatsapp/identity.js";

const BINDING_PATTERN = /\{\{([^}]+)\}\}/g;

export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".").filter(Boolean);
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function resolveBinding(
  template: string,
  context: Record<string, unknown>
): string {
  return template.replace(BINDING_PATTERN, (_match, path: string) => {
    const value = getNestedValue(context, path.trim());
    if (value === undefined || value === null) return "";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  });
}

export function resolveBindingValue(
  template: string | undefined,
  context: Record<string, unknown>
): string {
  if (!template) return "";
  if (!template.includes("{{")) return template;
  return resolveBinding(template, context).trim();
}

export function resolveNormalizedContactPhone(value?: string | null): string | null {
  const trimmed = value?.trim() || "";
  if (!trimmed || isWhatsAppBsuid(trimmed)) return null;
  const phone = normalizePhone(trimmed);
  return phone.length >= 10 ? phone : null;
}

function sanitizePhoneVariables(
  variables?: Record<string, string>
): Record<string, string> | undefined {
  if (!variables) return undefined;
  const sanitized = { ...variables };
  for (const key of ["phone", "contact_phone"] as const) {
    const value = sanitized[key];
    if (!value) continue;
    if (isWhatsAppBsuid(value) || !resolveNormalizedContactPhone(value)) {
      delete sanitized[key];
    }
  }
  return sanitized;
}

export function buildBindingContext(params: {
  formPayload?: Record<string, unknown> | undefined;
  variables?: Record<string, string> | undefined;
  conversation?: {
    phone?: string;
    contactName?: string;
  } | undefined;
}): Record<string, unknown> {
  const phone = resolveNormalizedContactPhone(params.conversation?.phone) || "";
  const contactName = params.conversation?.contactName?.trim() || "";
  const defaults: Record<string, string> = {};
  if (phone) {
    defaults.phone = phone;
    defaults.contact_phone = phone;
  }
  if (contactName) {
    defaults.contact_name = contactName;
    defaults.name = contactName;
  }
  return {
    form: params.formPayload ?? {},
    ...defaults,
    ...(sanitizePhoneVariables(params.variables) ?? {}),
  };
}

export function conversationBindingFromContext(ctx: {
  customerPhone?: string;
  conversation?: {
    phoneNumber?: string;
    participantId?: string;
    contactName?: string;
  };
}): { phone?: string; contactName?: string } {
  const phone =
    resolveNormalizedContactPhone(ctx.conversation?.phoneNumber) ||
    resolveNormalizedContactPhone(ctx.customerPhone) ||
    resolveNormalizedContactPhone(ctx.conversation?.participantId) ||
    undefined;
  const contactName = ctx.conversation?.contactName?.trim() || "";
  return {
    ...(phone ? { phone } : {}),
    ...(contactName ? { contactName } : {}),
  };
}

export function flattenFormPayload(payload: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};

  function walk(prefix: string, value: unknown): void {
    if (value === null || value === undefined) return;
    if (typeof value === "object" && !Array.isArray(value)) {
      for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
        walk(prefix ? `${prefix}.${key}` : key, nested);
      }
      return;
    }
    result[prefix] = String(value);
  }

  for (const [key, value] of Object.entries(payload)) {
    walk(`form.${key}`, value);
  }

  return result;
}

export function extractBindingPaths(template: string): string[] {
  const paths: string[] = [];
  let match: RegExpExecArray | null;
  const pattern = new RegExp(BINDING_PATTERN.source, "g");
  while ((match = pattern.exec(template)) !== null) {
    paths.push(match[1].trim());
  }
  return paths;
}
