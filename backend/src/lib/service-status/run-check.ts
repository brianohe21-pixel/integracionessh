import type { ServiceComponentStatus } from "../../types/index.js";
import {
  emptyComponent,
  statusFromProbe,
  telephonyHealthUrl,
  toUtcDateKey,
  upsertComponentDay,
} from "./aggregate.js";
import {
  getServiceStatusSnapshot,
  probeDynamoDbRoundTrip,
  putServiceStatusSnapshot,
} from "../dynamodb/service-status.repository.js";

async function probeTelephony(
  healthUrl: string
): Promise<{ ok: boolean; latencyMs: number }> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(healthUrl, {
      method: "GET",
      signal: controller.signal,
    });
    return {
      ok: response.ok,
      latencyMs: Date.now() - startedAt,
    };
  } catch {
    return { ok: false, latencyMs: Date.now() - startedAt };
  } finally {
    clearTimeout(timeout);
  }
}

function previousComponent(
  components: ServiceComponentStatus[],
  id: ServiceComponentStatus["id"]
): ServiceComponentStatus | undefined {
  return components.find((component) => component.id === id);
}

export async function runServiceStatusCheck(options?: {
  telephonyWsUrl?: string | null;
  now?: Date;
}): Promise<{ updatedAt: string; components: ServiceComponentStatus[] }> {
  const now = options?.now ?? new Date();
  const checkedAt = now.toISOString();
  const dayKey = toUtcDateKey(now);
  const existing = await getServiceStatusSnapshot();
  const previous = existing?.components ?? [];

  const dataProbe = await probeDynamoDbRoundTrip();
  const dataStatus = statusFromProbe(dataProbe.ok, dataProbe.latencyMs);
  const previousData = previousComponent(previous, "data");
  const dataComponent: ServiceComponentStatus = {
    id: "data",
    status: dataStatus,
    latencyMs: dataProbe.latencyMs,
    checkedAt,
    days: upsertComponentDay(previousData?.days ?? [], dayKey, dataStatus, now),
  };

  const components: ServiceComponentStatus[] = [dataComponent];

  const healthUrl = telephonyHealthUrl(options?.telephonyWsUrl);
  if (healthUrl) {
    const telephonyProbe = await probeTelephony(healthUrl);
    const telephonyStatus = statusFromProbe(
      telephonyProbe.ok,
      telephonyProbe.latencyMs
    );
    const previousTelephony = previousComponent(previous, "telephony");
    components.push({
      id: "telephony",
      status: telephonyStatus,
      latencyMs: telephonyProbe.latencyMs,
      checkedAt,
      days: upsertComponentDay(
        previousTelephony?.days ?? [],
        dayKey,
        telephonyStatus,
        now
      ),
    });
  }

  const previousApi = previousComponent(previous, "api") ?? emptyComponent("api", checkedAt);
  const apiComponent: ServiceComponentStatus = {
    id: "api",
    status: "operational",
    checkedAt,
    days: upsertComponentDay(previousApi.days, dayKey, "operational", now),
  };
  components.unshift(apiComponent);

  const snapshot = {
    updatedAt: checkedAt,
    components,
  };
  await putServiceStatusSnapshot(snapshot);
  return snapshot;
}
