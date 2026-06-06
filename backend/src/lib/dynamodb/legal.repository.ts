import { PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";

export interface LegalAcceptance {
  tenantId: string;
  userId: string;
  acceptedAt: string;
  termsVersion: string;
}

const TERMS_VERSION = "2026-05-30";

function legalKeys(tenantId: string, userId: string) {
  return {
    PK: `TENANT#${tenantId}`,
    SK: `LEGAL#${userId}`,
  };
}

export async function recordLegalAcceptance(
  tenantId: string,
  userId: string
): Promise<LegalAcceptance> {
  const acceptedAt = new Date().toISOString();
  const record: LegalAcceptance = {
    tenantId,
    userId,
    acceptedAt,
    termsVersion: TERMS_VERSION,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { ...legalKeys(tenantId, userId), ...record },
    })
  );

  return record;
}

export async function getLegalAcceptance(
  tenantId: string,
  userId: string
): Promise<LegalAcceptance | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: legalKeys(tenantId, userId),
    })
  );

  if (!result.Item) return null;
  const { PK, SK, ...rest } = result.Item;
  return rest as LegalAcceptance;
}

export { TERMS_VERSION };
