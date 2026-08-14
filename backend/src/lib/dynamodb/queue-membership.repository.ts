import { DeleteCommand, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type { QueueMembership } from "../../types/index.js";

function waitKeys(tenantId: string, queueId: string, queuedAt: string, callId: string) {
  return {
    PK: `TENANT#${tenantId}#CCQUEUE#${queueId}`,
    SK: `WAIT#${queuedAt}#${callId}`,
  };
}

function callLookupKeys(callId: string) {
  return {
    PK: `CCCALL#${callId}`,
    SK: "QUEUE",
  };
}

export async function enqueueQueueMembership(
  membership: QueueMembership
): Promise<QueueMembership> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...waitKeys(
          membership.tenantId,
          membership.queueId,
          membership.queuedAt,
          membership.callId
        ),
        ...membership,
      },
    })
  );
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...callLookupKeys(membership.callId),
        tenantId: membership.tenantId,
        queueId: membership.queueId,
        queuedAt: membership.queuedAt,
        callId: membership.callId,
        membershipId: membership.membershipId,
      },
    })
  );
  return membership;
}

export async function listQueueMemberships(
  tenantId: string,
  queueId: string
): Promise<QueueMembership[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}#CCQUEUE#${queueId}`,
        ":sk": "WAIT#",
      },
    })
  );
  return (result.Items ?? []).map(({ PK, SK, ...rest }) => {
    void PK;
    void SK;
    return rest as QueueMembership;
  });
}

export async function getQueueMembershipByCallId(
  callId: string
): Promise<QueueMembership | null> {
  const lookup = await docClient.send(
    new GetCommand({ TableName: TABLE_NAME, Key: callLookupKeys(callId) })
  );
  if (!lookup.Item) return null;
  const tenantId = String(lookup.Item.tenantId ?? "");
  const queueId = String(lookup.Item.queueId ?? "");
  const queuedAt = String(lookup.Item.queuedAt ?? "");
  if (!tenantId || !queueId || !queuedAt) return null;
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: waitKeys(tenantId, queueId, queuedAt, callId),
    })
  );
  if (!result.Item) return null;
  const { PK, SK, ...rest } = result.Item;
  void PK;
  void SK;
  return rest as QueueMembership;
}

export async function deleteQueueMembership(membership: QueueMembership): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: waitKeys(membership.tenantId, membership.queueId, membership.queuedAt, membership.callId),
    })
  );
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: callLookupKeys(membership.callId),
    })
  );
}
