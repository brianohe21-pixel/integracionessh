import { createPipeline, getDefaultPipeline } from "../dynamodb/pipeline.repository.js";
import { buildDefaultPipeline } from "../sales/default-pipeline.js";
import type { SalesPipeline } from "../../types/index.js";

export async function ensureDefaultPipeline(tenantId: string): Promise<SalesPipeline> {
  const existing = await getDefaultPipeline(tenantId);
  if (existing) return existing;

  const pipeline = buildDefaultPipeline(tenantId);
  await createPipeline(pipeline);
  return pipeline;
}
