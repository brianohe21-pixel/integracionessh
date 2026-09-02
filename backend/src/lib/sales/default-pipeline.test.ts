import {
  buildDefaultPipeline,
  buildDefaultPipelineStages,
  findStageByKey,
} from "./default-pipeline.js";

describe("default pipeline", () => {
  it("creates five ordered stages", () => {
    const stages = buildDefaultPipelineStages();
    expect(stages).toHaveLength(5);
    expect(stages.map((stage) => stage.key)).toEqual([
      "new",
      "quoted",
      "negotiation",
      "won",
      "lost",
    ]);
  });

  it("marks default pipeline as default", () => {
    const pipeline = buildDefaultPipeline("tenant-1");
    expect(pipeline.isDefault).toBe(true);
    expect(pipeline.tenantId).toBe("tenant-1");
    expect(pipeline.stages).toHaveLength(5);
  });

  it("finds stage by key", () => {
    const pipeline = buildDefaultPipeline("tenant-1");
    const stage = findStageByKey(pipeline, "quoted");
    expect(stage?.label).toBe("Cotizado");
  });
});
