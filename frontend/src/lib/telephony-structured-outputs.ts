import type {
  TelephonyStructuredOutputDefinition,
  TelephonyStructuredOutputType,
} from "@/types";

export type StructuredOutputExtractionMethod = "ai" | "regex";
export type StructuredOutputEditorMode = "form" | "json";

export const STRUCTURED_OUTPUT_FIELD_TYPES: TelephonyStructuredOutputType[] = [
  "string",
  "number",
  "integer",
  "boolean",
];

export interface StructuredOutputFormField {
  id: string;
  name: string;
  type: TelephonyStructuredOutputType;
  description: string;
  required: boolean;
  pattern?: string;
}

export interface StructuredOutputFormState {
  schemaName: string;
  description: string;
  fields: StructuredOutputFormField[];
}

const SCHEMA_NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function makeFieldId(): string {
  return `field_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeFieldType(value: unknown): TelephonyStructuredOutputType {
  if (value === "number" || value === "integer" || value === "boolean") return value;
  return "string";
}

function humanizeFieldName(name: string): string {
  return name.replace(/_/g, " ").trim();
}

function inferStructuredOutputType(value: unknown): TelephonyStructuredOutputType {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
  return "string";
}

function buildSchemaFromResult(result: Record<string, unknown>): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(result)) {
    properties[name] = {
      type: inferStructuredOutputType(value),
      description: humanizeFieldName(name),
    };
  }

  return {
    type: "object",
    properties,
    additionalProperties: false,
  };
}

export function parseStructuredOutputJson(json: string): TelephonyStructuredOutputDefinition | null {
  const trimmed = json.trim();
  if (!trimmed) return null;

  const parsed = JSON.parse(trimmed) as Record<string, unknown>;
  const name = typeof parsed.name === "string" ? parsed.name.trim() : "";
  if (!name) throw new Error("Schema name is required");

  const description =
    typeof parsed.description === "string" && parsed.description.trim()
      ? parsed.description.trim()
      : undefined;

  if (parsed.type === "regex") {
    if (
      !parsed.patterns ||
      typeof parsed.patterns !== "object" ||
      Array.isArray(parsed.patterns)
    ) {
      throw new Error("Regex extraction requires patterns object");
    }
    return {
      name,
      type: "regex",
      ...(description ? { description } : {}),
      patterns: parsed.patterns as Record<string, string>,
    };
  }

  if (parsed.schema && typeof parsed.schema === "object" && !Array.isArray(parsed.schema)) {
    return {
      name,
      type: "ai",
      ...(description ? { description } : {}),
      schema: parsed.schema as Record<string, unknown>,
    };
  }

  if (
    parsed.result &&
    typeof parsed.result === "object" &&
    !Array.isArray(parsed.result)
  ) {
    return {
      name,
      type: "ai",
      schema: buildSchemaFromResult(parsed.result as Record<string, unknown>),
    };
  }

  throw new Error("Invalid structured output JSON");
}

export function serializeStructuredOutputForEditor(
  definition: TelephonyStructuredOutputDefinition | null | undefined
): string {
  if (!definition?.name?.trim()) return "";

  if (definition.type === "regex" && definition.patterns) {
    return JSON.stringify(
      {
        name: definition.name,
        type: "regex",
        ...(definition.description ? { description: definition.description } : {}),
        patterns: definition.patterns,
      },
      null,
      2
    );
  }

  return JSON.stringify(
    {
      name: definition.name,
      type: "ai",
      ...(definition.description ? { description: definition.description } : {}),
      ...(definition.schema ? { schema: definition.schema } : {}),
    },
    null,
    2
  );
}

export function getStructuredOutputMethod(
  definition: TelephonyStructuredOutputDefinition | null | undefined
): StructuredOutputExtractionMethod {
  return definition?.type === "regex" ? "regex" : "ai";
}

export function createStructuredOutputField(
  type: TelephonyStructuredOutputType = "string"
): StructuredOutputFormField {
  return {
    id: makeFieldId(),
    name: "",
    type,
    description: "",
    required: false,
    pattern: "",
  };
}

export function definitionToFormState(
  definition: TelephonyStructuredOutputDefinition | null | undefined,
  method: StructuredOutputExtractionMethod
): StructuredOutputFormState {
  if (!definition?.name?.trim()) {
    return { schemaName: "", description: "", fields: [] };
  }

  if (method === "regex" && definition.patterns) {
    return {
      schemaName: definition.name,
      description: definition.description ?? "",
      fields: Object.entries(definition.patterns).map(([name, pattern]) => ({
        id: makeFieldId(),
        name,
        type: "string",
        description: humanizeFieldName(name),
        required: false,
        pattern,
      })),
    };
  }

  const schema = definition.schema;
  const properties = schema?.properties as
    | Record<string, { type?: string; description?: string }>
    | undefined;
  const required = new Set(
    Array.isArray(schema?.required) ? (schema.required as string[]) : []
  );

  if (!properties) {
    return {
      schemaName: definition.name,
      description: definition.description ?? "",
      fields: [],
    };
  }

  return {
    schemaName: definition.name,
    description: definition.description ?? "",
    fields: Object.entries(properties).map(([name, property]) => ({
      id: makeFieldId(),
      name,
      type: normalizeFieldType(property.type),
      description:
        typeof property.description === "string"
          ? property.description
          : humanizeFieldName(name),
      required: required.has(name),
    })),
  };
}

export function formStateToDefinition(
  state: StructuredOutputFormState,
  method: StructuredOutputExtractionMethod
): TelephonyStructuredOutputDefinition | null {
  const schemaName = state.schemaName.trim();
  const hasContent =
    schemaName.length > 0 ||
    state.description.trim().length > 0 ||
    state.fields.some((field) => field.name.trim().length > 0);

  if (!hasContent) return null;
  if (!schemaName) throw new Error("Schema name is required");

  const description = state.description.trim() || undefined;

  if (method === "regex") {
    const patterns: Record<string, string> = {};
    for (const field of state.fields) {
      const name = field.name.trim();
      const pattern = field.pattern?.trim();
      if (name && pattern) patterns[name] = pattern;
    }
    return {
      name: schemaName,
      type: "regex",
      ...(description ? { description } : {}),
      patterns,
    };
  }

  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const field of state.fields) {
    const name = field.name.trim();
    if (!name) continue;
    properties[name] = {
      type: field.type,
      ...(field.description.trim() ? { description: field.description.trim() } : {}),
    };
    if (field.required) required.push(name);
  }

  return {
    name: schemaName,
    type: "ai",
    ...(description ? { description } : {}),
    schema: {
      type: "object",
      properties,
      ...(required.length > 0 ? { required } : {}),
      additionalProperties: false,
    },
  };
}

export function getStructuredOutputExampleFormState(
  method: StructuredOutputExtractionMethod
): StructuredOutputFormState {
  if (method === "regex") {
    return {
      schemaName: "order_codes",
      description: "",
      fields: [
        {
          id: makeFieldId(),
          name: "order_id",
          type: "string",
          description: "Order ID",
          required: false,
          pattern: "ORD-[A-Z0-9]+",
        },
        {
          id: makeFieldId(),
          name: "phone_number",
          type: "string",
          description: "Phone number",
          required: false,
          pattern: "\\+?\\d{10,15}",
        },
      ],
    };
  }

  return {
    schemaName: "customer_order",
    description: "Extract order details from the call",
    fields: [
      {
        id: makeFieldId(),
        name: "customer_name",
        type: "string",
        description: "Customer full name",
        required: true,
      },
      {
        id: makeFieldId(),
        name: "phone_number",
        type: "string",
        description: "Customer phone number",
        required: false,
      },
      {
        id: makeFieldId(),
        name: "subtotal",
        type: "number",
        description: "Order subtotal",
        required: false,
      },
      {
        id: makeFieldId(),
        name: "resolved",
        type: "boolean",
        description: "Whether the issue was resolved",
        required: false,
      },
    ],
  };
}

export function validateStructuredOutputForm(
  state: StructuredOutputFormState,
  method: StructuredOutputExtractionMethod,
  t: (key: string) => string
): string | null {
  const schemaName = state.schemaName.trim();
  const hasFields = state.fields.some((field) => field.name.trim().length > 0);

  if (!schemaName && !hasFields) return null;
  if (!schemaName) return t("voiceAgents.structuredOutputsSchemaNameRequired");
  if (!SCHEMA_NAME_PATTERN.test(schemaName)) {
    return t("voiceAgents.structuredOutputsSchemaInvalid");
  }

  const names = state.fields.map((field) => field.name.trim()).filter(Boolean);
  if (names.length !== new Set(names).size) {
    return t("voiceAgents.structuredOutputsDuplicateField");
  }

  for (const field of state.fields) {
    const name = field.name.trim();
    if (!name) continue;
    if (!SCHEMA_NAME_PATTERN.test(name)) {
      return t("voiceAgents.structuredOutputsFieldNameInvalid");
    }
    if (method === "regex" && !field.pattern?.trim()) {
      return t("voiceAgents.structuredOutputsPatternRequired");
    }
  }

  return null;
}

export function validateStructuredOutputJson(
  json: string,
  t: (key: string) => string
): string | null {
  const trimmed = json.trim();
  if (!trimmed) return null;

  try {
    const definition = parseStructuredOutputJson(trimmed);
    if (!definition) return null;
    if (!SCHEMA_NAME_PATTERN.test(definition.name)) {
      return t("voiceAgents.structuredOutputsSchemaInvalid");
    }
    return null;
  } catch {
    return t("voiceAgents.structuredOutputsJsonInvalid");
  }
}

export const STRUCTURED_OUTPUT_AI_EXAMPLE = `{
  "name": "customer_order",
  "type": "ai",
  "result": {
    "subtotal": 34.98,
    "customer_name": "John Smith",
    "phone_number": "+15551234567"
  }
}`;

export const STRUCTURED_OUTPUT_REGEX_EXAMPLE = `{
  "name": "order_codes",
  "type": "regex",
  "patterns": {
    "order_id": "ORD-[A-Z0-9]+",
    "phone_number": "\\+?\\d{10,15}",
    "confirmation_code": "\\b[A-Z0-9]{6}\\b"
  }
}`;
