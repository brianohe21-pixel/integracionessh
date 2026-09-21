import { GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "../dynamodb/client.js";
import type { OutreachChannel } from "../../types/index.js";

export type OtpRecordStatus = "pending" | "verified";

export interface OtpRecord {
  tenantId: string;
  destinationHash: string;
  destination: string;
  botId: string;
  channel: OutreachChannel;
  codeHash: string;
  salt: string;
  attempts: number;
  maxAttempts: number;
  expiresAt: number;
  status: OtpRecordStatus;
  createdAt: string;
  updatedAt: string;
}

function otpKeys(tenantId: string, destinationHash: string) {
  return {
    PK: `OTP#${tenantId}#${destinationHash}`,
    SK: "META",
  };
}

function stripOtpItem(item: Record<string, unknown>): OtpRecord {
  const {
    PK: _pk,
    SK: _sk,
    ttl: _ttl,
    ...record
  } = item;
  return record as unknown as OtpRecord;
}

export async function putOtpRecord(record: Omit<OtpRecord, "createdAt" | "updatedAt">): Promise<OtpRecord> {
  const now = new Date().toISOString();
  const item = {
    ...otpKeys(record.tenantId, record.destinationHash),
    ...record,
    createdAt: now,
    updatedAt: now,
    ttl: record.expiresAt,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    })
  );

  return stripOtpItem(item);
}

export async function getOtpRecord(
  tenantId: string,
  destinationHash: string
): Promise<OtpRecord | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: otpKeys(tenantId, destinationHash),
    })
  );

  if (!result.Item) return null;
  return stripOtpItem(result.Item);
}

export async function incrementOtpAttempts(
  tenantId: string,
  destinationHash: string
): Promise<OtpRecord | null> {
  const now = new Date().toISOString();
  const result = await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: otpKeys(tenantId, destinationHash),
      UpdateExpression: "ADD attempts :one SET updatedAt = :now",
      ExpressionAttributeValues: {
        ":one": 1,
        ":now": now,
      },
      ReturnValues: "ALL_NEW",
    })
  );

  if (!result.Attributes) return null;
  return stripOtpItem(result.Attributes);
}

export async function markOtpVerified(
  tenantId: string,
  destinationHash: string
): Promise<OtpRecord | null> {
  const now = new Date().toISOString();
  const result = await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: otpKeys(tenantId, destinationHash),
      UpdateExpression: "SET #status = :verified, updatedAt = :now",
      ConditionExpression: "#status = :pending",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":verified": "verified",
        ":pending": "pending",
        ":now": now,
      },
      ReturnValues: "ALL_NEW",
    })
  );

  if (!result.Attributes) return null;
  return stripOtpItem(result.Attributes);
}
