import type {
  TelephonyStructuredOutputDefinition,
  TelephonyStructuredOutputType,
} from "@/types";

export type StructuredOutputExtractionMethod = "ai" | "regex";

const SCHEMA_NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

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
