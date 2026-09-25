import {
  DeleteCommand,
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type {
  PlatformServiceStatusSnapshot,
  ServiceComponentStatus,
} from "../../types/index.js";
import { buildHistoryWindow } from "../service-status/aggregate.js";

const SNAPSHOT_KEYS = {
  PK: "PLATFORM#STATUS",
  SK: "SNAPSHOT",
} as const;

const PROBE_KEYS = {
  PK: "PLATFORM#STATUS",
  SK: "PROBE",
} as const;

function normalizeComponent(raw: unknown): ServiceComponentStatus | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const id = item.id;
  if (id !== "api" && id !== "data" && id !== "telephony") return null;
  const status = item.status;
  if (
    status !== "operational" &&
    status !== "degraded" &&
    status !== "outage" &&
    status !== "unknown"
  ) {
    return null;
  }
  const checkedAt =
    typeof item.checkedAt === "string" && item.checkedAt
      ? item.checkedAt
      : new Date(0).toISOString();
  const daysRaw = Array.isArray(item.days) ? item.days : [];
  const days = buildHistoryWindow(
    daysRaw
      .filter(
        (day): day is { date: string; status: ServiceComponentStatus["status"] } =>
          Boolean(day) &&
          typeof day === "object" &&
          typeof (day as { date?: unknown }).date === "string" &&
          ["operational", "degraded", "outage", "unknown"].includes(
            (day as { status?: unknown }).status as string
          )
      )
      .map((day) => ({
        date: day.date,
        status: day.status,
      }))
  );

  return {
    id,
    status,
    checkedAt,
    days,
    ...(typeof item.latencyMs === "number" && Number.isFinite(item.latencyMs)
      ? { latencyMs: Math.max(0, Math.round(item.latencyMs)) }
      : {}),
  };
}

function stripSnapshot(item: Record<string, unknown>): PlatformServiceStatusSnapshot {
  const updatedAt =
    typeof item.updatedAt === "string" && item.updatedAt
      ? item.updatedAt
      : new Date(0).toISOString();
  const components = Array.isArray(item.components)
    ? item.components
        .map((component) => normalizeComponent(component))
        .filter((component): component is ServiceComponentStatus => Boolean(component))
    : [];

  return { updatedAt, components };
}

export async function getServiceStatusSnapshot(): Promise<PlatformServiceStatusSnapshot | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: SNAPSHOT_KEYS,
    })
  );
  if (!result.Item) return null;
  return stripSnapshot(result.Item as Record<string, unknown>);
}

export async function putServiceStatusSnapshot(
  snapshot: PlatformServiceStatusSnapshot
): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...SNAPSHOT_KEYS,
        updatedAt: snapshot.updatedAt,
        components: snapshot.components,
      },
    })
  );
}

export async function probeDynamoDbRoundTrip(): Promise<{
  ok: boolean;
  latencyMs: number;
}> {
  const startedAt = Date.now();
  const checkedAt = new Date().toISOString();
  const ttl = Math.floor(Date.now() / 1000) + 3600;

  try {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          ...PROBE_KEYS,
          checkedAt,
          ttl,
        },
      })
    );
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: PROBE_KEYS,
      })
    );
    if (!result.Item) {
      return { ok: false, latencyMs: Date.now() - startedAt };
    }
    await docClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: PROBE_KEYS,
      })
    );
    return { ok: true, latencyMs: Date.now() - startedAt };
  } catch {
    return { ok: false, latencyMs: Date.now() - startedAt };
  }
}
