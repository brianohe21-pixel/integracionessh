import { z } from "zod";

const ScreenSchema = z.object({
  id: z.string().min(1),
}).passthrough();

export const MetaFlowJsonSchema = z.object({
  version: z.string().min(1),
  screens: z.array(ScreenSchema).min(1),
}).passthrough();

export function validateMetaFlowJson(json: unknown): Record<string, unknown> {
  return MetaFlowJsonSchema.parse(json) as Record<string, unknown>;
}
