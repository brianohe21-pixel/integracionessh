import { z } from "zod";
import type { TelephonyStructuredOutputDefinition } from "../../types/index.js";
import {
  parseStructuredOutputJson,
  validateStructuredOutputJson,
} from "./structured-output-config.js";

export const StructuredOutputDefinitionSchema = z
  .object({
    name: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/).max(64),
    type: z.enum(["ai", "regex"]).optional(),
    description: z.string().max(500).optional(),
    schema: z.record(z.unknown()).optional(),
    patterns: z.record(z.string()).optional(),
    result: z.record(z.unknown()).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.result && typeof value.result === "object") {
      return;
    }

    if (value.type === "regex") {
      if (!value.patterns || Object.keys(value.patterns).length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "patterns required for regex extraction",
        });
      }
      return;
    }

    if (!value.schema) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "schema or result required for ai extraction",
      });
    }
  });

export function parseStructuredOutputDefinitionInput(
  input: unknown
): TelephonyStructuredOutputDefinition | null {
  if (input === null) return null;

  const parsed = StructuredOutputDefinitionSchema.safeParse(input);
  if (!parsed.success) {
    throw Object.assign(new Error(parsed.error.errors[0]?.message ?? "Invalid structured output"), {
      statusCode: 400,
    });
  }

  if (parsed.data.result) {
    const fromExample = parseStructuredOutputJson(JSON.stringify(parsed.data));
    if (!fromExample) {
      throw Object.assign(new Error("Invalid structured output"), { statusCode: 400 });
    }
    return fromExample;
  }

  const { result: _result, ...definition } = parsed.data;
  return definition as TelephonyStructuredOutputDefinition;
}

export function assertStructuredOutputDefinitionInput(input: unknown): void {
  if (input === null) return;

  const validationError = validateStructuredOutputJson(JSON.stringify(input));
  if (validationError) {
    throw Object.assign(new Error(validationError), { statusCode: 400 });
  }

  parseStructuredOutputDefinitionInput(input);
}

export function buildStructuredOutputBotUpdates(
  definition: TelephonyStructuredOutputDefinition | null
): Record<string, unknown> {
  return {
    telephonyStructuredOutput: definition,
    telephonyStructuredOutputs: null,
    telephonyStructuredOutputSchemaName: null,
  };
}
