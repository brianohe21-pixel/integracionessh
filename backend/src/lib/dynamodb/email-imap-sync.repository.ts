import { GetCommand, PutCommand, DeleteCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";

export interface EmailImapSyncState {
  tenantId: string;
  botId: string;
  uidValidity: number;
  lastUid: number;
  lastPolledAt?: string;
  consecutiveFailures: number;
  nextPollAfter?: string;
}

function syncStateKey(tenantId: string, botId: string) {
  return {
    PK: `TENANT#${tenantId}`,
    SK: `EMAILIMAP#${botId}`,
  };
}

function activeLookupKey(tenantId: string, botId: string) {
  return {
    PK: "LOOKUP#EMAILIMAP#ACTIVE",
    SK: `TENANT#${tenantId}#BOT#${botId}`,
  };
}

export async function getEmailImapSyncState(
  tenantId: string,
  botId: string
): Promise<EmailImapSyncState | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: syncStateKey(tenantId, botId),
    })
  );
  if (!result.Item) return null;
  const item = result.Item;
  return {
    tenantId: item.tenantId as string,
    botId: item.botId as string,
    uidValidity: item.uidValidity as number,
    lastUid: item.lastUid as number,
    consecutiveFailures: (item.consecutiveFailures as number) ?? 0,
    ...(item.lastPolledAt ? { lastPolledAt: item.lastPolledAt as string } : {}),
    ...(item.nextPollAfter ? { nextPollAfter: item.nextPollAfter as string } : {}),
  };
}

export async function putEmailImapSyncState(state: EmailImapSyncState): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...syncStateKey(state.tenantId, state.botId),
        ...state,
        updatedAt: new Date().toISOString(),
      },
    })
  );
}

export async function putEmailImapActiveLookup(
  tenantId: string,
  botId: string,
  emailAddress: string
): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...activeLookupKey(tenantId, botId),
        tenantId,
        botId,
        emailAddress: emailAddress.toLowerCase(),
        updatedAt: new Date().toISOString(),
      },
    })
  );
}

export async function deleteEmailImapActiveLookup(
  tenantId: string,
  botId: string
): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: activeLookupKey(tenantId, botId),
    })
  );
}

export async function deleteEmailImapSyncState(
  tenantId: string,
  botId: string
): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: syncStateKey(tenantId, botId),
    })
  );
}

export async function listActiveEmailImapLookups(): Promise<
  Array<{ tenantId: string; botId: string; emailAddress: string }>
> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: {
        ":pk": "LOOKUP#EMAILIMAP#ACTIVE",
      },
    })
  );
  return (result.Items ?? []).map((item) => ({
    tenantId: item.tenantId as string,
    botId: item.botId as string,
    emailAddress: item.emailAddress as string,
  }));
}
