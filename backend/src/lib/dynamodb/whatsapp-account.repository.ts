import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type { WhatsAppAccount } from "../../types/index.js";

const accountKeys = (tenantId: string, accountId: string) => ({
  PK: `TENANT#${tenantId}`,
  SK: `WAACCOUNT#${accountId}`,
});

function wabaLookupKey(wabaId: string) {
  return {
    PK: `LOOKUP#WABA#${wabaId}`,
    SK: "META",
  };
}

export async function listWhatsAppAccounts(tenantId: string): Promise<WhatsAppAccount[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}`,
        ":sk": "WAACCOUNT#",
      },
    })
  );
  return (result.Items ?? []).map(({ PK, SK, ...rest }) => rest as WhatsAppAccount);
}

export async function getWhatsAppAccount(
  tenantId: string,
  accountId: string
): Promise<WhatsAppAccount | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: accountKeys(tenantId, accountId),
    })
  );
  if (!result.Item) return null;
  const { PK, SK, ...rest } = result.Item;
  return rest as WhatsAppAccount;
}

export async function getWhatsAppAccountByWabaId(
  wabaId: string
): Promise<WhatsAppAccount | null> {
  const lookup = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: wabaLookupKey(wabaId),
    })
  );
  if (!lookup.Item) return null;
  const tenantId = lookup.Item.tenantId as string;
  const accountId = lookup.Item.accountId as string;
  return getWhatsAppAccount(tenantId, accountId);
}

export async function upsertWhatsAppAccount(account: WhatsAppAccount): Promise<WhatsAppAccount> {
  const now = new Date().toISOString();
  const item = {
    ...accountKeys(account.tenantId, account.accountId),
    ...account,
    updatedAt: now,
    createdAt: account.createdAt ?? now,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    })
  );

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...wabaLookupKey(account.wabaId),
        tenantId: account.tenantId,
        accountId: account.accountId,
        updatedAt: now,
      },
    })
  );

  return item;
}

export async function deleteWhatsAppAccount(
  tenantId: string,
  accountId: string,
  wabaId: string
): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: accountKeys(tenantId, accountId),
    })
  );
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: wabaLookupKey(wabaId),
    })
  );
}

export async function updateWhatsAppAccount(
  tenantId: string,
  accountId: string,
  updates: Partial<
    Pick<WhatsAppAccount, "label" | "status" | "messagingEnforcement">
  >
): Promise<WhatsAppAccount | null> {
  const existing = await getWhatsAppAccount(tenantId, accountId);
  if (!existing) return null;

  const setExpressions: string[] = [];
  const values: Record<string, unknown> = {};
  const names: Record<string, string> = {};

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    names[`#${key}`] = key;
    values[`:${key}`] = value;
    setExpressions.push(`#${key} = :${key}`);
  }

  if (!setExpressions.length) return existing;

  const updatedAt = new Date().toISOString();
  names["#updatedAt"] = "updatedAt";
  values[":updatedAt"] = updatedAt;
  setExpressions.push("#updatedAt = :updatedAt");

  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: accountKeys(tenantId, accountId),
      UpdateExpression: `SET ${setExpressions.join(", ")}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    })
  );

  return { ...existing, ...updates, updatedAt };
}
