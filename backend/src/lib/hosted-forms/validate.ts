import { randomUUID } from "crypto";
import type {
  HostedForm,
  HostedFormCrmMapping,
  HostedFormField,
} from "../../types/index.js";
import { HOSTED_FORM_FIELD_TYPES } from "../../types/index.js";

export const MAX_HOSTED_FORM_FIELDS = 40;
export const MAX_FIELD_OPTIONS = 30;
export const FIELD_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{0,39}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function defaultHostedFormFields(): HostedFormField[] {
  return [
    { id: randomUUID(), type: "text", name: "name", label: "Name", required: true },
    { id: randomUUID(), type: "email", name: "email", label: "Email", required: true },
    { id: randomUUID(), type: "phone", name: "phone", label: "Phone", required: true },
    { id: randomUUID(), type: "textarea", name: "message", label: "Message", required: false },
  ];
}

export function defaultCrmMapping(): HostedFormCrmMapping {
  return { name: "name", email: "email", phone: "phone" };
}

export function validateFormDefinition(params: {
  fields: HostedFormField[];
  crmMapping: HostedFormCrmMapping;
  createLeadOnSubmit: boolean;
  botId?: string;
  redirectUrl?: string;
}): void {
  if (params.fields.length === 0) {
    throwObject("At least one field is required");
  }
  if (params.fields.length > MAX_HOSTED_FORM_FIELDS) {
    throwObject(`Maximum ${MAX_HOSTED_FORM_FIELDS} fields per form`);
  }

  const names = new Set<string>();
  const ids = new Set<string>();
  for (const field of params.fields) {
    if (!HOSTED_FORM_FIELD_TYPES.includes(field.type)) {
      throwObject(`Unsupported field type: ${field.type}`);
    }
    if (!FIELD_NAME_PATTERN.test(field.name)) {
      throwObject(`Invalid field name: ${field.name}`);
    }
    if (!field.label.trim()) {
      throwObject("Field label is required");
    }
    if (names.has(field.name)) {
      throwObject(`Duplicate field name: ${field.name}`);
    }
    names.add(field.name);
    if (ids.has(field.id)) {
      throwObject(`Duplicate field id: ${field.id}`);
    }
    ids.add(field.id);

    if (field.type === "select" || field.type === "radio") {
      if (!field.options?.length) {
        throwObject(`Field ${field.name} requires options`);
      }
    }
    if (field.options && field.options.length > MAX_FIELD_OPTIONS) {
      throwObject(`Field ${field.name} has too many options`);
    }
    if (field.options) {
      const optionValues = new Set<string>();
      for (const option of field.options) {
        if (!option.value.trim() || !option.label.trim()) {
          throwObject(`Field ${field.name} has an empty option`);
        }
        if (optionValues.has(option.value)) {
          throwObject(`Field ${field.name} has duplicate option values`);
        }
        optionValues.add(option.value);
      }
    }
  }

  if (params.redirectUrl) {
    try {
      const parsed = new URL(params.redirectUrl);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        throwObject("redirectUrl must be an http(s) URL");
      }
    } catch (err) {
      if ((err as Error & { statusCode?: number }).statusCode) throw err;
      throwObject("redirectUrl must be a valid URL");
    }
  }

  const mappingKeys = ["name", "email", "phone"] as const;
  for (const key of mappingKeys) {
    const mapped = params.crmMapping[key];
    if (mapped && !names.has(mapped)) {
      throwObject(`CRM mapping ${key} references unknown field ${mapped}`);
    }
  }

  if (params.createLeadOnSubmit) {
    if (!params.botId) {
      throwObject("A bot is required to create leads from this form");
    }
    if (!params.crmMapping.phone) {
      throwObject("Map a phone field to create leads");
    }
  }
}

export function validateAndNormalizeSubmission(
  fields: HostedFormField[],
  raw: Record<string, unknown>
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  for (const field of fields) {
    const value = raw[field.name];
    const normalized = normalizeFieldValue(field, value);
    if (field.required && isEmptyValue(normalized)) {
      throwObject(`${field.label} is required`);
    }
    if (!isEmptyValue(normalized)) {
      payload[field.name] = normalized;
    }
  }

  return payload;
}

export function mappedCrmValues(
  mapping: HostedFormCrmMapping,
  payload: Record<string, unknown>
): { name?: string; email?: string; phone?: string } {
  const name = stringValue(payload[mapping.name ?? ""]);
  const email = stringValue(payload[mapping.email ?? ""]);
  const phone = stringValue(payload[mapping.phone ?? ""]);
  return {
    ...(name ? { name } : {}),
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
  };
}

function normalizeFieldValue(field: HostedFormField, value: unknown): unknown {
  if (value === undefined || value === null) {
    return field.defaultValue ?? (field.type === "checkbox" && field.options?.length ? [] : "");
  }

  if (field.type === "checkbox" && field.options?.length) {
    const list = Array.isArray(value) ? value : [value];
    const allowed = new Set(field.options.map((option) => option.value));
    const selected = list
      .map((item) => String(item))
      .filter((item) => allowed.has(item));
    return selected;
  }

  if (field.type === "checkbox") {
    return value === true || value === "true" || value === "on" || value === "1";
  }

  const text = typeof value === "string" ? value.trim() : String(value);
  const maxLen = field.type === "textarea" ? 2000 : 500;
  const clipped = text.slice(0, maxLen);

  if (field.type === "email" && clipped && !EMAIL_PATTERN.test(clipped)) {
    throwObject(`${field.label} must be a valid email`);
  }
  if (field.type === "phone" && clipped) {
    const digits = clipped.replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 20) {
      throwObject(`${field.label} must be a valid phone number`);
    }
    return digits;
  }
  if (field.type === "number" && clipped) {
    const num = Number(clipped);
    if (!Number.isFinite(num)) {
      throwObject(`${field.label} must be a number`);
    }
    return num;
  }
  if (field.type === "date" && clipped && !DATE_PATTERN.test(clipped)) {
    throwObject(`${field.label} must be a valid date`);
  }
  if ((field.type === "select" || field.type === "radio") && clipped) {
    const allowed = new Set((field.options ?? []).map((option) => option.value));
    if (!allowed.has(clipped)) {
      throwObject(`${field.label} has an invalid option`);
    }
  }
  return clipped;
}

function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (typeof value === "boolean") return false;
  if (typeof value === "number") return false;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function stringValue(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function throwObject(message: string): never {
  const err = new Error(message) as Error & { statusCode?: number };
  err.statusCode = 400;
  throw err;
}

export function toPublicForm(form: HostedForm): Pick<
  HostedForm,
  "name" | "description" | "fields" | "submitLabel" | "successTitle" | "successMessage"
> {
  return {
    name: form.name,
    ...(form.description ? { description: form.description } : {}),
    fields: form.fields,
    submitLabel: form.submitLabel,
    successTitle: form.successTitle,
    successMessage: form.successMessage,
  };
}
