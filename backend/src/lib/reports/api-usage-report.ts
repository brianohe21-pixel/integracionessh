import { listApiKeysByTenant } from "../dynamodb/api-key.repository.js";
import { listApiKeyUsageInRange } from "../dynamodb/api-key-usage.repository.js";
import { getTenantIntegration } from "../dynamodb/integration.repository.js";
import type {
  ApiUsageByEndpoint,
  ApiUsageByKey,
  ApiUsageCount,
  ApiUsageDailyPoint,
  ApiUsageReport,
  ApiUsageWebhookStatus,
  TenantIntegration,
} from "../../types/index.js";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 90;

export type ApiUsageRange =
  | { ok: true; from: string; to: string }
  | { ok: false; message: string };

export interface ApiUsageLogInput {
  keyId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  createdAt: string;
}

export interface ApiUsageKeyInput {
  keyId: string;
  name: string;
  prefix: string;
}

function emptyCount(): ApiUsageCount {
  return { requests: 0, success: 0, error: 0 };
}

function addCount(target: ApiUsageCount, statusCode: number): void {
  target.requests += 1;
  if (statusCode < 400) target.success += 1;
  else target.error += 1;
}

export function parseApiUsageRange(from: string, to: string): ApiUsageRange {
  if (!DATE_ONLY.test(from) || !DATE_ONLY.test(to)) {
    return { ok: false, message: "Invalid date range" };
  }

  const startMs = Date.parse(`${from}T00:00:00.000Z`);
  const endMs = Date.parse(`${to}T00:00:00.000Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return { ok: false, message: "Invalid date range" };
  }

  const nextFrom = from <= to ? from : to;
  const nextTo = from <= to ? to : from;
  const spanMs = Date.parse(`${nextTo}T00:00:00.000Z`) - Date.parse(`${nextFrom}T00:00:00.000Z`);
  const days = Math.floor(spanMs / 86_400_000) + 1;
  if (days > MAX_RANGE_DAYS) {
    return { ok: false, message: "Date range cannot exceed 90 days" };
  }

  return { ok: true, from: nextFrom, to: nextTo };
}

export function apiUsageSkBounds(from: string, to: string): { fromSk: string; toSk: string } {
  return {
    fromSk: `${from}T00:00:00.000Z`,
    toSk: `${to}T23:59:59.999Z#\uffff`,
  };
}

function eachDate(from: string, to: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${from}T00:00:00.000Z`);
  const end = Date.parse(`${to}T00:00:00.000Z`);
  while (cursor.getTime() <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export function toWebhookStatuses(
  integration: Pick<
    TenantIntegration,
    "integrationId" | "enabled" | "webhookUrl" | "subscribedEvents"
  > | null
): ApiUsageWebhookStatus[] {
  if (!integration) return [];
  return [
    {
      integrationId: integration.integrationId,
      status: integration.enabled ? "active" : "inactive",
      url: integration.webhookUrl,
      events: [...integration.subscribedEvents],
    },
  ];
}

export function buildApiUsageReport(params: {
  from: string;
  to: string;
  keys: ApiUsageKeyInput[];
  logs: ApiUsageLogInput[];
  integration: Pick<
    TenantIntegration,
    "integrationId" | "enabled" | "webhookUrl" | "subscribedEvents"
  > | null;
}): ApiUsageReport {
  const totals = emptyCount();
  const byKey = new Map<string, ApiUsageByKey>();
  const byEndpoint = new Map<string, ApiUsageByEndpoint>();
  const daily = new Map<string, ApiUsageDailyPoint>();

  for (const date of eachDate(params.from, params.to)) {
    daily.set(date, { date, ...emptyCount() });
  }

  for (const key of params.keys) {
    byKey.set(key.keyId, {
      keyId: key.keyId,
      keyName: key.name,
      prefix: key.prefix,
      ...emptyCount(),
    });
  }

  for (const log of params.logs) {
    addCount(totals, log.statusCode);

    const keyRow = byKey.get(log.keyId);
    if (keyRow) addCount(keyRow, log.statusCode);

    const endpointKey = `${log.method}\n${log.endpoint}`;
    let endpointRow = byEndpoint.get(endpointKey);
    if (!endpointRow) {
      endpointRow = {
        endpoint: log.endpoint,
        method: log.method,
        ...emptyCount(),
      };
      byEndpoint.set(endpointKey, endpointRow);
    }
    addCount(endpointRow, log.statusCode);

    const day = log.createdAt.slice(0, 10);
    const dayRow = daily.get(day);
    if (dayRow) addCount(dayRow, log.statusCode);
  }

  return {
    from: params.from,
    to: params.to,
    totals,
    daily: [...daily.values()],
    byKey: [...byKey.values()].sort(
      (a, b) => b.requests - a.requests || a.keyName.localeCompare(b.keyName)
    ),
    byEndpoint: [...byEndpoint.values()].sort(
      (a, b) =>
        b.requests - a.requests ||
        a.endpoint.localeCompare(b.endpoint) ||
        a.method.localeCompare(b.method)
    ),
    webhooks: toWebhookStatuses(params.integration),
  };
}

export async function getApiUsageReport(
  tenantId: string,
  from: string,
  to: string
): Promise<ApiUsageReport> {
  const [keys, integration] = await Promise.all([
    listApiKeysByTenant(tenantId),
    getTenantIntegration(tenantId),
  ]);
  const { fromSk, toSk } = apiUsageSkBounds(from, to);
  const logGroups = await Promise.all(
    keys.map((key) => listApiKeyUsageInRange(tenantId, key.keyId, fromSk, toSk))
  );

  return buildApiUsageReport({
    from,
    to,
    keys: keys.map((key) => ({
      keyId: key.keyId,
      name: key.name,
      prefix: key.prefix,
    })),
    logs: logGroups.flat(),
    integration,
  });
}
