import type {
  ServiceComponentId,
  ServiceComponentStatus,
  ServiceStatusDay,
  ServiceStatusLevel,
} from "../../types/index.js";

export const SERVICE_STATUS_HISTORY_DAYS = 90;
export const SERVICE_STATUS_DEGRADED_LATENCY_MS = 2000;
export const SERVICE_STATUS_STALE_MS = 15 * 60 * 1000;

const STATUS_RANK: Record<ServiceStatusLevel, number> = {
  unknown: 0,
  operational: 1,
  degraded: 2,
  outage: 3,
};

export function worseStatus(
  a: ServiceStatusLevel,
  b: ServiceStatusLevel
): ServiceStatusLevel {
  return STATUS_RANK[a] >= STATUS_RANK[b] ? a : b;
}

export function statusFromProbe(
  ok: boolean,
  latencyMs: number
): ServiceStatusLevel {
  if (!ok) return "outage";
  if (latencyMs > SERVICE_STATUS_DEGRADED_LATENCY_MS) return "degraded";
  return "operational";
}

export function mergeDayStatus(
  existing: ServiceStatusLevel | undefined,
  next: ServiceStatusLevel
): ServiceStatusLevel {
  if (!existing || existing === "unknown") return next;
  if (next === "unknown") return existing;
  return worseStatus(existing, next);
}

export function toUtcDateKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function buildHistoryWindow(
  days: ServiceStatusDay[],
  endDate: Date = new Date()
): ServiceStatusDay[] {
  const byDate = new Map(days.map((day) => [day.date, day.status]));
  const end = new Date(
    Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate())
  );
  const result: ServiceStatusDay[] = [];

  for (let i = SERVICE_STATUS_HISTORY_DAYS - 1; i >= 0; i -= 1) {
    const current = new Date(end);
    current.setUTCDate(end.getUTCDate() - i);
    const date = toUtcDateKey(current);
    result.push({
      date,
      status: byDate.get(date) ?? "unknown",
    });
  }

  return result;
}

export function upsertComponentDay(
  days: ServiceStatusDay[],
  date: string,
  status: ServiceStatusLevel,
  endDate: Date = new Date()
): ServiceStatusDay[] {
  const byDate = new Map(days.map((day) => [day.date, day.status]));
  byDate.set(date, mergeDayStatus(byDate.get(date), status));
  return buildHistoryWindow(
    Array.from(byDate.entries()).map(([day, dayStatus]) => ({
      date: day,
      status: dayStatus,
    })),
    endDate
  );
}

export function overallFromComponents(
  components: Array<Pick<ServiceComponentStatus, "status">>
): ServiceStatusLevel {
  if (components.length === 0) return "unknown";
  let overall: ServiceStatusLevel = "unknown";
  for (const component of components) {
    overall = worseStatus(overall, component.status);
  }
  return overall;
}

export function isSnapshotStale(
  updatedAt: string,
  nowMs: number = Date.now()
): boolean {
  const updatedMs = Date.parse(updatedAt);
  if (!Number.isFinite(updatedMs)) return true;
  return nowMs - updatedMs > SERVICE_STATUS_STALE_MS;
}

export function applyStaleToComponents(
  components: ServiceComponentStatus[],
  stale: boolean
): ServiceComponentStatus[] {
  if (!stale) return components;
  return components.map((component) => {
    if (component.id === "api") return component;
    return {
      ...component,
      status: "unknown" as const,
    };
  });
}

export function telephonyHealthUrl(wsUrl: string | undefined | null): string | null {
  const trimmed = (wsUrl ?? "").trim();
  if (!trimmed) return null;
  try {
    const httpUrl = trimmed.replace(/^wss:/i, "https:").replace(/^ws:/i, "http:");
    const url = new URL(httpUrl);
    url.pathname = "/health";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function emptyComponent(
  id: ServiceComponentId,
  checkedAt: string,
  status: ServiceStatusLevel = "unknown"
): ServiceComponentStatus {
  return {
    id,
    status,
    checkedAt,
    days: buildHistoryWindow([]),
  };
}
