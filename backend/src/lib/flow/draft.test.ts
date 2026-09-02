import {
  flowGraphSnapshotKey,
  hasUnpublishedChanges,
  nextPublishedVersion,
  resolveDraftNodes,
} from "./draft.js";
import type { FlowDefinition } from "../../types/index.js";

function baseFlow(overrides: Partial<FlowDefinition> = {}): FlowDefinition {
  return {
    flowId: "flow-1",
    tenantId: "tenant-1",
    name: "Test",
    enabled: false,
    version: 2,
    nodes: [{ id: "n1", type: "trigger", position: { x: 0, y: 0 }, data: {} }],
    edges: [],
    entryNodeId: "n1",
    publishedAt: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("flow draft helpers", () => {
  it("detects unpublished draft changes", () => {
    const flow = baseFlow({
      draftNodes: [
        { id: "n1", type: "trigger", position: { x: 0, y: 0 }, data: { label: "draft" } },
      ],
    });
    expect(hasUnpublishedChanges(flow)).toBe(true);
  });

  it("uses published graph when draft is missing", () => {
    const flow = baseFlow();
    expect(resolveDraftNodes(flow)).toEqual(flow.nodes);
    expect(hasUnpublishedChanges(flow)).toBe(false);
  });

  it("increments published version", () => {
    expect(nextPublishedVersion(baseFlow())).toBe(3);
    const unpublished = baseFlow({ version: 0 });
    delete unpublished.publishedAt;
    expect(nextPublishedVersion(unpublished)).toBe(1);
  });

  it("builds stable graph snapshot keys", () => {
    const nodes = [{ id: "n1", type: "trigger" as const, position: { x: 0, y: 0 }, data: {} }];
    const key = flowGraphSnapshotKey(nodes, []);
    expect(key).toBe(flowGraphSnapshotKey(nodes, []));
  });
});
