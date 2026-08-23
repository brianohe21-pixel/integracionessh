import { randomUUID } from "crypto";
import type { OpportunityStage, PipelineStage, SalesPipeline } from "../../types/index.js";

export const DEFAULT_PIPELINE_STAGES: Array<{
  key: OpportunityStage;
  label: string;
  probability: number;
  isClosed?: boolean;
  outcome?: "won" | "lost";
}> = [
  { key: "new", label: "Nuevo", probability: 10 },
  { key: "quoted", label: "Cotizado", probability: 30 },
  { key: "negotiation", label: "Negociación", probability: 60 },
  { key: "won", label: "Ganado", probability: 100, isClosed: true, outcome: "won" },
  { key: "lost", label: "Perdido", probability: 0, isClosed: true, outcome: "lost" },
];

export function buildDefaultPipelineStages(): PipelineStage[] {
  return DEFAULT_PIPELINE_STAGES.map((stage, index) => ({
    stageId: randomUUID(),
    key: stage.key,
    label: stage.label,
    sortOrder: index,
    probability: stage.probability,
    ...(stage.isClosed ? { isClosed: true } : {}),
    ...(stage.outcome ? { outcome: stage.outcome } : {}),
  }));
}

export function buildDefaultPipeline(tenantId: string): SalesPipeline {
  const now = new Date().toISOString();
  return {
    pipelineId: randomUUID(),
    tenantId,
    name: "Pipeline principal",
    isDefault: true,
    stages: buildDefaultPipelineStages(),
    createdAt: now,
    updatedAt: now,
  };
}

export function findStageByKey(
  pipeline: SalesPipeline,
  key: OpportunityStage
): PipelineStage | undefined {
  return pipeline.stages.find((stage) => stage.key === key);
}

export function findStageById(
  pipeline: SalesPipeline,
  stageId: string
): PipelineStage | undefined {
  return pipeline.stages.find((stage) => stage.stageId === stageId);
}

export function getFirstOpenStage(pipeline: SalesPipeline): PipelineStage {
  const sorted = [...pipeline.stages].sort((a, b) => a.sortOrder - b.sortOrder);
  return sorted.find((stage) => !stage.isClosed) ?? sorted[0]!;
}
