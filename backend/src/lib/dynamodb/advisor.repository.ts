import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type { Advisor } from "../../types/index.js";

const advisorKeys = (tenantId: string, advisorId: string) => ({
  PK: `TENANT#${tenantId}`,
  SK: `ADVISOR#${advisorId}`,
});

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export async function getAdvisor(
  tenantId: string,
  advisorId: string
): Promise<Advisor | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: advisorKeys(tenantId, advisorId),
    })
  );

  if (!result.Item) return null;

  const { PK, SK, GSI1PK, GSI1SK, ...rest } = result.Item;
  return rest as Advisor;
}

export async function getAdvisorByPhone(
  tenantId: string,
  phoneNumber: string
): Promise<Advisor | null> {
  const gsi1pk = `TENANT#${tenantId}#ADVISOR_PHONE#${normalizePhone(phoneNumber)}`;

  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :gsi1pk",
      ExpressionAttributeValues: { ":gsi1pk": gsi1pk },
      Limit: 1,
    })
  );

  if (!result.Items?.length) return null;

  const { PK, SK, GSI1PK, GSI1SK, ...rest } = result.Items[0];
  return rest as Advisor;
}

export async function getAdvisorByCognitoUserId(
  tenantId: string,
  cognitoUserId: string
): Promise<Advisor | null> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      FilterExpression: "cognitoUserId = :uid AND #status = :active",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}`,
        ":sk": "ADVISOR#",
        ":uid": cognitoUserId,
        ":active": "active",
      },
    })
  );

  if (!result.Items?.length) return null;

  const { PK, SK, GSI1PK, GSI1SK, ...rest } = result.Items[0];
  return rest as Advisor;
}

export async function listAdvisors(tenantId: string): Promise<Advisor[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}`,
        ":sk": "ADVISOR#",
      },
    })
  );

  return (result.Items ?? []).map(({ PK, SK, GSI1PK, GSI1SK, ...rest }) => rest as Advisor);
}

export async function createAdvisor(advisor: Advisor): Promise<Advisor> {
  const gsi1pk = `TENANT#${advisor.tenantId}#ADVISOR_PHONE#${normalizePhone(advisor.phoneNumber)}`;

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...advisorKeys(advisor.tenantId, advisor.advisorId),
        GSI1PK: gsi1pk,
        GSI1SK: `ADVISOR#${advisor.createdAt}`,
        ...advisor,
      },
      ConditionExpression: "attribute_not_exists(PK)",
    })
  );

  return advisor;
}

export async function updateAdvisor(
  tenantId: string,
  advisorId: string,
  updates: Partial<
    Pick<Advisor, "name" | "phoneNumber" | "status" | "botIds" | "cognitoUserId" | "lastAssignedAt">
  >
): Promise<Advisor | null> {
  const existing = await getAdvisor(tenantId, advisorId);
  if (!existing) return null;

  const now = new Date().toISOString();
  const merged: Advisor = {
    ...existing,
    ...updates,
    updatedAt: now,
  };

  const gsi1pk = `TENANT#${tenantId}#ADVISOR_PHONE#${normalizePhone(merged.phoneNumber)}`;

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...advisorKeys(tenantId, advisorId),
        GSI1PK: gsi1pk,
        GSI1SK: `ADVISOR#${merged.createdAt}`,
        ...merged,
      },
    })
  );

  return merged;
}

export async function touchAdvisorAssignment(tenantId: string, advisorId: string): Promise<void> {
  const now = new Date().toISOString();
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: advisorKeys(tenantId, advisorId),
      UpdateExpression: "SET lastAssignedAt = :now, updatedAt = :now",
      ExpressionAttributeValues: { ":now": now },
    })
  );
}
