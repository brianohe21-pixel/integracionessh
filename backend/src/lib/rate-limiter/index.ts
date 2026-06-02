import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "../dynamodb/client.js";
import type { RateLimitResult } from "../../types/index.js";

function minuteKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}T${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

function dayKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function toEpochSeconds(d: Date): number {
  return Math.floor(d.getTime() / 1000);
}

async function incrementCounter(pk: string, sk: string, ttlSeconds: number): Promise<number> {
  const expiry = toEpochSeconds(new Date()) + ttlSeconds;

  const result = await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: pk, SK: sk },
      UpdateExpression: "ADD #count :one SET #ttl = if_not_exists(#ttl, :expiry)",
      ExpressionAttributeNames: { "#count": "count", "#ttl": "ttl" },
      ExpressionAttributeValues: { ":one": 1, ":expiry": expiry },
      ReturnValues: "ALL_NEW",
    })
  );

  return (result.Attributes?.["count"] as number) ?? 1;
}

export async function checkAndIncrement(
  hashedKey: string,
  limitPerMinute: number,
  limitPerDay: number
): Promise<RateLimitResult> {
  const mKey = minuteKey();
  const dKey = dayKey();

  const minutePK = `RATELIMIT#${hashedKey}#MINUTE`;
  const dayPK = `RATELIMIT#${hashedKey}#DAY`;

  const [minuteCount, dayCount] = await Promise.all([
    incrementCounter(minutePK, mKey, 120),
    incrementCounter(dayPK, dKey, 172800),
  ]);

  const minuteRemaining = Math.max(0, limitPerMinute - minuteCount);
  const dayRemaining = Math.max(0, limitPerDay - dayCount);

  if (minuteCount > limitPerMinute) {
    const now = new Date();
    const secondsUntilNextMinute = 60 - now.getUTCSeconds();
    return {
      allowed: false,
      minuteRemaining: 0,
      dayRemaining,
      retryAfterSeconds: secondsUntilNextMinute,
    };
  }

  if (dayCount > limitPerDay) {
    const now = new Date();
    const nextDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    const secondsUntilNextDay = Math.floor((nextDay.getTime() - now.getTime()) / 1000);
    return {
      allowed: false,
      minuteRemaining,
      dayRemaining: 0,
      retryAfterSeconds: secondsUntilNextDay,
    };
  }

  return { allowed: true, minuteRemaining, dayRemaining };
}
