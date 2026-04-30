import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type { Tenant } from "../../types/index.js";

const keys = (tenantId: string) => ({
  PK: `TENANT#${tenantId}`,
  SK: "METADATA",
});

export async function getTenant(tenantId: string): Promise<Tenant | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: keys(tenantId),
    })
  );

  if (!result.Item) return null;

  const { PK, SK, GSI1PK, GSI1SK, ...rest } = result.Item;
  return rest as Tenant;
}

export async function createTenant(tenant: Tenant): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...keys(tenant.tenantId),
        GSI1PK: "TENANT",
        GSI1SK: `STATUS#${tenant.status}#${tenant.tenantId}`,
        ...tenant,
      },
      ConditionExpression: "attribute_not_exists(PK)",
    })
  );
}

export async function updateTenant(
  tenantId: string,
  updates: Partial<Omit<Tenant, "tenantId" | "createdAt">>
): Promise<Tenant> {
  const updateExpression: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, unknown> = {};

  Object.entries({ ...updates, updatedAt: new Date().toISOString() }).forEach(
    ([key, value]) => {
      updateExpression.push(`#${key} = :${key}`);
      expressionAttributeNames[`#${key}`] = key;
      expressionAttributeValues[`:${key}`] = value;
    }
  );

  const result = await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: keys(tenantId),
      UpdateExpression: `SET ${updateExpression.join(", ")}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: "ALL_NEW",
    })
  );

  const { PK, SK, GSI1PK, GSI1SK, ...rest } = result.Attributes ?? {};
  return rest as Tenant;
}

export async function deleteTenant(tenantId: string): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: keys(tenantId),
    })
  );
}

export async function listTenants(): Promise<Tenant[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :gsi1pk",
      ExpressionAttributeValues: { ":gsi1pk": "TENANT" },
    })
  );

  return (result.Items ?? []).map(({ PK, SK, GSI1PK, GSI1SK, ...rest }) => rest as Tenant);
}
