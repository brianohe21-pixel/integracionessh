import { z } from "zod";

const ScreenSchema = z
  .object({
    id: z.string().min(1),
    terminal: z.boolean().optional(),
    data: z.record(z.unknown()).optional(),
    success: z.boolean().optional(),
  })
  .passthrough();

export const MetaFlowJsonSchema = z
  .object({
    version: z.string().min(1),
    screens: z.array(ScreenSchema).min(1),
  })
  .passthrough();

export interface MetaFlowValidationIssue {
  message: string;
  path?: string;
}

function normalizeScreen(screen: Record<string, unknown>): Record<string, unknown> {
  const normalized = { ...screen };
  if (normalized.data === undefined) {
    normalized.data = {};
  }
  if (normalized.terminal === true && normalized.success === undefined) {
    normalized.success = true;
  }
  return normalized;
}

function normalizeComponent(node: unknown): unknown {
  if (!node || typeof node !== "object") return node;
  const record = { ...(node as Record<string, unknown>) };
  if ("input_type" in record && !("input-type" in record)) {
    record["input-type"] = String(record.input_type).toLowerCase();
    delete record.input_type;
  }
  if (Array.isArray(record.children)) {
    record.children = record.children.map(normalizeComponent);
  }
  const layout = record.layout;
  if (layout && typeof layout === "object") {
    record.layout = normalizeComponent(layout);
  }
  return record;
}

export function normalizeMetaFlowJson(json: Record<string, unknown>): Record<string, unknown> {
  const version = typeof json.version === "string" ? json.version : "7.3";
  const screens = Array.isArray(json.screens)
    ? json.screens.map((screen) => {
        if (!screen || typeof screen !== "object") return screen;
        return normalizeComponent(normalizeScreen(screen as Record<string, unknown>));
      })
    : [];

  return {
    ...json,
    version,
    screens,
  };
}

export function validateMetaFlowJson(json: unknown): Record<string, unknown> {
  const parsed = MetaFlowJsonSchema.parse(json) as Record<string, unknown>;
  return normalizeMetaFlowJson(parsed);
}

export function formatMetaValidationErrors(
  errors: Array<{ message?: string; path?: string; error?: string }>
): string {
  if (!errors.length) return "Invalid Flow JSON";
  return errors
    .map((issue) => {
      const label = issue.path ? `${issue.path}: ` : "";
      return `${label}${issue.message ?? issue.error ?? "Validation error"}`;
    })
    .join("; ");
}
