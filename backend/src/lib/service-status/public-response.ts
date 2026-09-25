import type {
  PlatformServiceStatusSnapshot,
  PublicServiceStatusResponse,
  ServiceComponentStatus,
} from "../../types/index.js";
import {
  applyStaleToComponents,
  buildHistoryWindow,
  emptyComponent,
  isSnapshotStale,
  overallFromComponents,
  toUtcDateKey,
  upsertComponentDay,
} from "./aggregate.js";

export function buildPublicServiceStatusResponse(
  snapshot: PlatformServiceStatusSnapshot | null,
  now: Date = new Date()
): PublicServiceStatusResponse {
  const nowIso = now.toISOString();
  const stale = snapshot ? isSnapshotStale(snapshot.updatedAt, now.getTime()) : true;

  const byId = new Map(
    (snapshot?.components ?? []).map((component) => [component.id, component])
  );

  const apiPrevious = byId.get("api");
  const api: ServiceComponentStatus = {
    id: "api",
    status: "operational",
    checkedAt: nowIso,
    days: upsertComponentDay(
      apiPrevious?.days ?? buildHistoryWindow([]),
      toUtcDateKey(now),
      "operational",
      now
    ),
    ...(typeof apiPrevious?.latencyMs === "number"
      ? { latencyMs: apiPrevious.latencyMs }
      : {}),
  };

  const data = byId.get("data") ?? emptyComponent("data", snapshot?.updatedAt ?? nowIso);
  const telephony = byId.get("telephony");

  const components = applyStaleToComponents(
    telephony ? [api, data, telephony] : [api, data],
    stale
  );

  return {
    updatedAt: snapshot?.updatedAt ?? nowIso,
    overall: stale ? "unknown" : overallFromComponents(components),
    stale,
    components,
  };
}
